import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import common from 'oci-common';
import core from 'oci-core';
import { getSettings } from './store.js';

const TCP_PROTOCOL = '6';
const UDP_PROTOCOL = '17';

function ruleDescription(listenPort, protocol) {
  return `port-panel:${listenPort}/${protocol}`;
}

function isPanelRule(description) {
  return typeof description === 'string' && description.startsWith('port-panel:');
}

function getOciConfigPath() {
  return process.env.OCI_CONFIG_FILE || path.join(os.homedir(), '.oci', 'config');
}

export function getOciStatus() {
  const configPath = getOciConfigPath();
  const exists = fs.existsSync(configPath);
  return {
    configured: exists,
    configPath,
    message: exists
      ? 'OCI конфигурацията е намерена.'
      : 'Липсва ~/.oci/config — security list няма да се обновява автоматично.',
  };
}

async function getClient() {
  const configPath = getOciConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(`OCI config not found at ${configPath}`);
  }

  const settings = await getSettings();
  const provider = new common.ConfigFileAuthenticationDetailsProvider(configPath);
  const client = new core.VirtualNetworkClient({
    authenticationDetailsProvider: provider,
  });
  client.regionId = settings.region;
  return client;
}

function makeIngressRule(listenPort, protocol) {
  const options =
    protocol === 'tcp'
      ? {
          tcpOptions: {
            destinationPortRange: { min: listenPort, max: listenPort },
          },
        }
      : {
          udpOptions: {
            destinationPortRange: { min: listenPort, max: listenPort },
          },
        };

  return {
    description: ruleDescription(listenPort, protocol),
    source: '0.0.0.0/0',
    sourceType: 'CIDR_BLOCK',
    isStateless: false,
    protocol: protocol === 'tcp' ? TCP_PROTOCOL : UDP_PROTOCOL,
    ...options,
  };
}

function protocolsFor(forward) {
  if (forward.protocol === 'both') return ['tcp', 'udp'];
  return [forward.protocol];
}

async function getSecurityList(client, securityListId) {
  const response = await client.getSecurityList({ securityListId });
  return response.securityList;
}

export async function syncForwardToSecurityList(forward, { remove = false } = {}) {
  const settings = await getSettings();
  const client = await getClient();
  const securityList = await getSecurityList(client, settings.securityListId);

  const desiredDescriptions = new Set(
    protocolsFor(forward).map((p) => ruleDescription(forward.listenPort, p)),
  );

  const keptRules = (securityList.ingressSecurityRules || []).filter((rule) => {
    if (!isPanelRule(rule.description)) return true;
    if (remove && desiredDescriptions.has(rule.description)) return false;
    if (!remove && desiredDescriptions.has(rule.description)) return true;
    return true;
  });

  let nextRules = keptRules;
  if (!remove) {
    const existingDescriptions = new Set(
      keptRules.map((rule) => rule.description).filter(Boolean),
    );
    for (const protocol of protocolsFor(forward)) {
      const desc = ruleDescription(forward.listenPort, protocol);
      if (!existingDescriptions.has(desc)) {
        nextRules = [...nextRules, makeIngressRule(forward.listenPort, protocol)];
      }
    }
  }

  await client.updateSecurityList({
    securityListId: settings.securityListId,
    updateSecurityListDetails: {
      ingressSecurityRules: nextRules,
      egressSecurityRules: securityList.egressSecurityRules || [],
    },
  });

  return { success: true, message: remove ? 'Security list правилото е премахнато.' : 'Security list правилото е добавено.' };
}

export async function syncForwardRuleUpdate(oldForward, newForward) {
  if (
    oldForward.listenPort === newForward.listenPort &&
    oldForward.protocol === newForward.protocol
  ) {
    return syncForwardToSecurityList(newForward);
  }

  await syncForwardToSecurityList(oldForward, { remove: true }).catch(() => {});
  return syncForwardToSecurityList(newForward);
}

export async function checkOciConnection() {
  try {
    const settings = await getSettings();
    const client = await getClient();
    await client.getSecurityList({ securityListId: settings.securityListId });
    return { ok: true, message: 'OCI връзката работи.' };
  } catch (error) {
    return { ok: false, message: error.message || String(error) };
  }
}

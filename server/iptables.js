import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DRY_RUN } from './config.js';

const execFileAsync = promisify(execFile);

function commentTag(id) {
  return `port-panel:${id}`;
}

async function run(cmd, args) {
  const full = `${cmd} ${args.join(' ')}`;
  if (DRY_RUN) {
    console.log('[dry-run]', full);
    return { stdout: '', stderr: '' };
  }
  return execFileAsync('sudo', [cmd, ...args], { timeout: 15000 });
}

export async function ensureForwardingEnabled() {
  if (DRY_RUN) {
    console.log('[dry-run] enable ip_forward');
    return;
  }
  await execFileAsync('sudo', ['sysctl', '-w', 'net.ipv4.ip_forward=1'], {
    timeout: 10000,
  });
}

async function masqueradeExists() {
  if (DRY_RUN) return false;
  const { stdout } = await execFileAsync(
    'sudo',
    ['iptables', '-t', 'nat', '-S', 'POSTROUTING'],
    { timeout: 10000 },
  );
  return stdout.includes('-j MASQUERADE');
}

export async function ensureMasquerade() {
  if (await masqueradeExists()) return;
  await run('iptables', ['-t', 'nat', '-A', 'POSTROUTING', '-j', 'MASQUERADE']);
}

async function deleteRulesByComment(id) {
  const tag = commentTag(id);
  if (DRY_RUN) {
    console.log(`[dry-run] delete rules with comment ${tag}`);
    return;
  }

  for (const tableChain of [
    ['nat', 'PREROUTING'],
    ['filter', 'FORWARD'],
  ]) {
    const [table, chain] = tableChain;
    const { stdout } = await execFileAsync(
      'sudo',
      ['iptables', '-t', table, '-S', chain],
      { timeout: 10000 },
    );
    const lines = stdout.split('\n').filter((line) => line.includes(tag));
    for (const line of lines) {
      const rule = line.replace(/^-A /, '');
      await run('iptables', ['-t', table, '-D', chain, ...tokenizeRule(rule)]);
    }
  }
}

function tokenizeRule(rule) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let match;
  while ((match = re.exec(rule)) !== null) {
    tokens.push(match[1] ?? match[2]);
  }
  return tokens;
}

function protocolArgs(protocol) {
  if (protocol === 'both') return ['tcp', 'udp'];
  return [protocol];
}

export async function applyForward(forward) {
  await ensureForwardingEnabled();
  await deleteRulesByComment(forward.id);

  for (const proto of protocolArgs(forward.protocol)) {
    await run('iptables', [
      '-t',
      'nat',
      '-A',
      'PREROUTING',
      '-p',
      proto,
      '--dport',
      String(forward.listenPort),
      '-m',
      'comment',
      '--comment',
      commentTag(forward.id),
      '-j',
      'DNAT',
      '--to-destination',
      `${forward.destIp}:${forward.destPort}`,
    ]);

    await run('iptables', [
      '-A',
      'FORWARD',
      '-p',
      proto,
      '-d',
      forward.destIp,
      '--dport',
      String(forward.destPort),
      '-m',
      'comment',
      '--comment',
      commentTag(forward.id),
      '-j',
      'ACCEPT',
    ]);
  }

  await ensureMasquerade();
}

export async function removeForward(forward) {
  await deleteRulesByComment(forward.id);
}

export async function syncAllForwards(forwards) {
  await ensureForwardingEnabled();
  await ensureMasquerade();

  if (!DRY_RUN) {
    const { stdout: natRules } = await execFileAsync(
      'sudo',
      ['iptables', '-t', 'nat', '-S', 'PREROUTING'],
      { timeout: 10000 },
    );
    const { stdout: fwdRules } = await execFileAsync(
      'sudo',
      ['iptables', '-S', 'FORWARD'],
      { timeout: 10000 },
    );
    const panelRules = [...natRules.split('\n'), ...fwdRules.split('\n')].filter(
      (line) => line.includes('port-panel:'),
    );
    for (const line of panelRules) {
      const isNat = line.startsWith('-A PREROUTING');
      const table = isNat ? 'nat' : 'filter';
      const chain = isNat ? 'PREROUTING' : 'FORWARD';
      const rule = line.replace(/^-A \w+ /, '');
      await run('iptables', ['-t', table, '-D', chain, ...tokenizeRule(rule)]);
    }
  } else {
    console.log('[dry-run] clear all port-panel rules');
  }

  for (const forward of forwards) {
    await applyForward(forward);
  }
}

export async function persistRules() {
  if (DRY_RUN) {
    console.log('[dry-run] persist iptables rules');
    return;
  }
  try {
    await execFileAsync('sudo', ['netfilter-persistent', 'save'], {
      timeout: 15000,
    });
  } catch {
    await execFileAsync('sudo', ['sh', '-c', 'iptables-save > /etc/iptables/rules.v4'], {
      timeout: 15000,
    }).catch(() => {
      console.warn('Could not persist iptables rules automatically.');
    });
  }
}

import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {
  CREDENTIALS_FILE,
  DATA_DIR,
  DEFAULT_SETTINGS,
  FORWARDS_FILE,
  SETTINGS_FILE,
} from './config.js';

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function initStore() {
  await ensureDataDir();

  const credentials = await readJson(CREDENTIALS_FILE, null);
  if (!credentials) {
    const hash = await bcrypt.hash('admin', 10);
    await writeJson(CREDENTIALS_FILE, { username: 'admin', passwordHash: hash });
  }

  const settings = await readJson(SETTINGS_FILE, null);
  if (!settings) {
    await writeJson(SETTINGS_FILE, DEFAULT_SETTINGS);
  }

  const forwards = await readJson(FORWARDS_FILE, null);
  if (!forwards) {
    await writeJson(FORWARDS_FILE, []);
  }
}

export async function getCredentials() {
  return readJson(CREDENTIALS_FILE, { username: 'admin', passwordHash: '' });
}

export async function updateCredentials({ username, passwordHash }) {
  const current = await getCredentials();
  await writeJson(CREDENTIALS_FILE, {
    username: username ?? current.username,
    passwordHash: passwordHash ?? current.passwordHash,
  });
}

export async function getSettings() {
  const settings = await readJson(SETTINGS_FILE, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function updateSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await writeJson(SETTINGS_FILE, next);
  return next;
}

export async function getForwards() {
  return readJson(FORWARDS_FILE, []);
}

export async function saveForwards(forwards) {
  await writeJson(FORWARDS_FILE, forwards);
  return forwards;
}

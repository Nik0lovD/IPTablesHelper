import bcrypt from 'bcryptjs';
import { getCredentials, updateCredentials } from './store.js';

export async function verifyLogin(username, password) {
  const credentials = await getCredentials();
  if (username !== credentials.username) return false;
  return bcrypt.compare(password, credentials.passwordHash);
}

export async function changePassword(currentPassword, newPassword) {
  const credentials = await getCredentials();
  const valid = await bcrypt.compare(currentPassword, credentials.passwordHash);
  if (!valid) {
    throw new Error('Текущата парола е грешна.');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await updateCredentials({ passwordHash });
}

export async function changeUsername(currentPassword, newUsername) {
  const credentials = await getCredentials();
  const valid = await bcrypt.compare(currentPassword, credentials.passwordHash);
  if (!valid) {
    throw new Error('Текущата парола е грешна.');
  }
  if (!newUsername?.trim()) {
    throw new Error('Username не може да е празен.');
  }
  await updateCredentials({ username: newUsername.trim() });
}

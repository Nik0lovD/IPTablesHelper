import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

export const PORT = Number(process.env.PORT || 8787);
export const DATA_DIR = path.join(rootDir, 'data');
export const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
export const FORWARDS_FILE = path.join(DATA_DIR, 'forwards.json');
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
export const CLIENT_DIST = path.join(rootDir, 'client', 'dist');
export const IS_LINUX = process.platform === 'linux';
export const DRY_RUN = process.env.DRY_RUN === '1' || !IS_LINUX;

export const DEFAULT_SETTINGS = {
  region: 'eu-frankfurt-1',
  securityListId:
    'ocid1.securitylist.oc1.eu-frankfurt-1.aaaaaaaa74zykvt7jn5qmg2o7cayvbaefvwkjkiflr6qrujqosccvmorqdqa',
  securityListUrl:
    'https://cloud.oracle.com/networking/vcns/ocid1.vcn.oc1.eu-frankfurt-1.amaaaaaamls4usaak2pgig5sv362sd22rlqqata7yjqdqrat6wzovn6tfwza/security-lists/ocid1.securitylist.oc1.eu-frankfurt-1.aaaaaaaa74zykvt7jn5qmg2o7cayvbaefvwkjkiflr6qrujqosccvmorqdqa/security-rules?region=eu-frankfurt-1',
};

export const SESSION_SECRET =
  process.env.SESSION_SECRET || 'networking-panel-dev-secret-change-me';

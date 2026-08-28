import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { changePassword, changeUsername, verifyLogin } from './auth.js';
import {
  CLIENT_DIST,
  DRY_RUN,
  PORT,
  SESSION_SECRET,
} from './config.js';
import {
  applyForward,
  persistRules,
  removeForward,
  syncAllForwards,
} from './iptables.js';
import {
  checkOciConnection,
  getOciStatus,
  syncForwardRuleUpdate,
  syncForwardToSecurityList,
} from './oci.js';
import {
  getForwards,
  getSettings,
  initStore,
  saveForwards,
  updateSettings,
} from './store.js';

const app = express();

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function validateForward(body, existing = []) {
  const listenPort = Number(body.listenPort);
  const destPort = Number(body.destPort);
  const destIp = String(body.destIp || '').trim();
  const protocol = body.protocol;

  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
    throw new Error('Listen port трябва да е между 1 и 65535.');
  }
  if (!Number.isInteger(destPort) || destPort < 1 || destPort > 65535) {
    throw new Error('Dest port трябва да е между 1 и 65535.');
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(destIp)) {
    throw new Error('Dest IP е невалидно.');
  }
  if (!['tcp', 'udp', 'both'].includes(protocol)) {
    throw new Error('Protocol трябва да е tcp, udp или both.');
  }

  const duplicate = existing.find(
    (item) =>
      item.listenPort === listenPort &&
      item.id !== body.id &&
      (item.protocol === protocol ||
        protocol === 'both' ||
        item.protocol === 'both'),
  );
  if (duplicate) {
    throw new Error(`Listen port ${listenPort} вече се използва.`);
  }

  return { listenPort, destPort, destIp, protocol };
}

async function withOciSync(action, forward, options = {}) {
  const settings = await getSettings();
  const status = getOciStatus();
  if (!status.configured) {
    return {
      oci: {
        success: false,
        message: status.message,
        securityListUrl: settings.securityListUrl,
      },
    };
  }

  try {
    const result = await action(forward, options);
    return {
      oci: {
        success: true,
        message: result.message,
        securityListUrl: settings.securityListUrl,
      },
    };
  } catch (error) {
    return {
      oci: {
        success: false,
        message: error.message || String(error),
        securityListUrl: settings.securityListUrl,
      },
    };
  }
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const ok = await verifyLogin(username, password);
  if (!ok) {
    return res.status(401).json({ error: 'Грешно потребителско име или парола.' });
  }
  req.session.user = { username };
  res.json({ username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(req.session.user);
});

app.get('/api/status', requireAuth, async (_req, res) => {
  const settings = await getSettings();
  const ociStatus = getOciStatus();
  const ociCheck = ociStatus.configured ? await checkOciConnection() : null;
  res.json({
    dryRun: DRY_RUN,
    oci: {
      ...ociStatus,
      connection: ociCheck,
      securityListUrl: settings.securityListUrl,
    },
  });
});

app.get('/api/settings', requireAuth, async (_req, res) => {
  res.json(await getSettings());
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    const { region, securityListId, securityListUrl } = req.body || {};
    const settings = await updateSettings({
      ...(region ? { region } : {}),
      ...(securityListId ? { securityListId } : {}),
      ...(securityListUrl ? { securityListUrl } : {}),
    });
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/credentials', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, newUsername } = req.body || {};
    if (newUsername) {
      await changeUsername(currentPassword, newUsername);
      req.session.user.username = newUsername.trim();
    }
    if (newPassword) {
      await changePassword(currentPassword, newPassword);
    }
    res.json({ username: req.session.user.username });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/forwards', requireAuth, async (_req, res) => {
  res.json(await getForwards());
});

app.post('/api/forwards', requireAuth, async (req, res) => {
  try {
    const forwards = await getForwards();
    const data = validateForward(req.body || {}, forwards);
    const forward = { id: uuidv4(), ...data };

    await applyForward(forward);
    await persistRules();

    const ociResult = await withOciSync(
      (item) => syncForwardToSecurityList(item),
      forward,
    );

    forwards.push(forward);
    await saveForwards(forwards);

    res.status(201).json({ forward, ...ociResult });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/forwards/:id', requireAuth, async (req, res) => {
  try {
    const forwards = await getForwards();
    const index = forwards.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Forward not found.' });

    const oldForward = forwards[index];
    const data = validateForward(
      { ...req.body, id: req.params.id },
      forwards,
    );
    const updated = { ...oldForward, ...data };

    await applyForward(updated);
    await persistRules();

    const ociResult = await withOciSync(
      (item, opts) =>
        opts.oldForward
          ? syncForwardRuleUpdate(opts.oldForward, item)
          : syncForwardToSecurityList(item),
      updated,
      { oldForward },
    );

    forwards[index] = updated;
    await saveForwards(forwards);

    res.json({ forward: updated, ...ociResult });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/forwards/:id', requireAuth, async (req, res) => {
  try {
    const forwards = await getForwards();
    const index = forwards.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Forward not found.' });

    const [removed] = forwards.splice(index, 1);
    await removeForward(removed);
    await persistRules();

    const ociResult = await withOciSync(
      (item) => syncForwardToSecurityList(item, { remove: true }),
      removed,
    );

    await saveForwards(forwards);
    res.json({ ok: true, ...ociResult });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/resync', requireAuth, async (_req, res) => {
  try {
    const forwards = await getForwards();
    await syncAllForwards(forwards);
    await persistRules();
    res.json({ ok: true, count: forwards.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(CLIENT_DIST));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

await initStore();

app.listen(PORT, () => {
  console.log(`Networking panel listening on http://0.0.0.0:${PORT}`);
  if (DRY_RUN) {
    console.log('Running in dry-run mode (iptables commands are logged only).');
  }
});

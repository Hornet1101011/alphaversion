const { MongoClient, ServerApiVersion } = require('mongodb');

function encode(p) {
  return encodeURIComponent(p);
}

async function tryConnect(uri, label) {
  console.log(`Trying (${label}): ${uri.replace(/:[^:@]+@/, ':<redacted>@')}`);
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    // keep selection short for quick failure
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log(`Connected successfully using ${label}`);
    await client.close();
    return true;
  } catch (err) {
    console.error(`${label} connection error:`, err && err.message ? err.message : err);
    try { await client.close(); } catch (_) {}
    return false;
  }
}

(async () => {
  // If a full MONGODB_URI is provided, try it first.
  const directUri = process.env.MONGODB_URI;
  if (directUri) {
    const okDirect = await tryConnect(directUri, 'direct MONGODB_URI');
    if (okDirect) return process.exit(0);
    console.warn('Direct MONGODB_URI attempt failed — will try username/password fallbacks.');
  }

  const username = process.env.MONGO_USER || process.env.MONGODB_USER || 'zedrickjohnhabacon_db_user';
  const password = process.env.MONGO_PASS || process.env.MONGODB_PASS || 'Z3drick112511256';
  const clusterHost = process.env.MONGO_CLUSTER || process.env.MONGODB_CLUSTER || 'cluster0.fu4calt.mongodb.net';
  const dbName = process.env.MONGO_DB || 'alphaversion';

  if (!username || !password) {
    console.error('Missing credentials. Set env MONGO_USER and MONGO_PASS before running, or set MONGODB_URI.');
    return process.exit(2);
  }

  const encoded = encode(password);

  const srvUri = `mongodb+srv://${username}:${encoded}@${clusterHost}/${dbName}?retryWrites=true&w=majority`;

  // 1) try SRV first
  const okSrv = await tryConnect(srvUri, 'SRV');
  if (okSrv) return process.exit(0);

  // 2) if SRV failed with DNS/SRV issues, try non-SRV seed hosts derived from clusterHost
  // clusterHost expected like "cluster0.fu4calt.mongodb.net"
  const idx = clusterHost.indexOf('.');
  if (idx === -1) {
    console.error('Unable to parse cluster host:', clusterHost);
    return process.exit(1);
  }
  const prefix = clusterHost.substring(0, idx); // cluster0
  const rest = clusterHost.substring(idx + 1); // fu4calt.mongodb.net
  const hosts = [
    `${prefix}-shard-00-00.${rest}:27017`,
    `${prefix}-shard-00-01.${rest}:27017`,
    `${prefix}-shard-00-02.${rest}:27017`,
  ];

  const nonSrvUri = `mongodb://${username}:${encoded}@${hosts.join(',')}/${dbName}?authSource=admin&retryWrites=true&w=majority`;
  const okNonSrv = await tryConnect(nonSrvUri, 'non-SRV (seed hosts)');
  if (okNonSrv) return process.exit(0);

  console.error('All connection attempts failed. Try switching to a different network (mobile hotspot) or updating DNS to 8.8.8.8/1.1.1.1.');
  process.exit(1);
})();

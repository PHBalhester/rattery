import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import pg from 'pg';

// Explicitly linked, separate staging export. Never read a production project.
const root = 'test-results/staging-source/';
const project = JSON.parse(readFileSync(root + '.vercel/project.json', 'utf8'));
if (project.projectId !== 'prj_NXWV0FKHk5q7dGqBfJpNCynKl0Dv') throw Error('Not the authorized staging project');
const env = parseEnv(readFileSync(root + '.env.staging.local', 'utf8'));
if (env.VITE_STAGING !== 'true' || env.RATTERY_CA) throw Error('Staging with payments disabled required');
const url = new URL(env.DATABASE_URL_UNPOOLED);
if (!url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler')) throw Error('Direct Neon connection required');
// Explicit verified TLS; prevent URL parameters overriding pg TLS policy.
url.search = '';
const pool = new pg.Pool({connectionString:url.href, ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:15000});
try {
  const exists = await pool.query("SELECT 1 FROM pg_database WHERE datname=$1", ['rattery_staging_test']);
  if (!exists.rowCount) await pool.query('CREATE DATABASE rattery_staging_test');
} catch {
  console.error('Hosted staging database setup failed; connection details suppressed.');
  process.exitCode=1;
} finally { await pool.end(); }
if (!process.exitCode) {
  url.pathname='/rattery_staging_test';
  const child=spawnSync(process.execPath,['--import','tsx','scripts/persistence-test.ts'],{
    env:{...process.env,RATTERY_TEST_DATABASE_URL:url.href},encoding:'utf8',timeout:240000,maxBuffer:1024*1024
  });
  // Only emit known safe status lines; pg exceptions can contain connection details.
  console.log((child.stdout||'').split('\n').filter(line=>/^(PASS |ALL PASS )/.test(line)).join('\n'));
  if(child.status!==0){console.error('Hosted suite failed; raw diagnostic output withheld.');process.exitCode=1;}
  else {
    mkdirSync('test-results/persistence',{recursive:true});
    const report=JSON.parse(readFileSync('test-results/persistence/report.json','utf8'));
    writeFileSync('test-results/persistence/hosted-report.json',JSON.stringify({...report,environment:'Neon staging, isolated test database, verified TLS',at:new Date().toISOString()},null,2));
  }
}

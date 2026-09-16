#!/usr/bin/env python3
# Scan the exact Git index: report filenames/rules, never secret values.
import json,re,subprocess,sys
from pathlib import PurePosixPath
files=subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
if not any(files):
    sys.exit('No Git index found. Stage the reviewed publication files first.')
rules={
 'private key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'GitHub credential':r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
 'AWS credential':r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
 'Slack credential':r'\bxox[baprs]-[A-Za-z0-9-]{20,}\b',
 'authenticated URL':r'https?://[^\s/]+:[^\s/@]+@',
 'home directory':r'(?:/home/|/Users/|[A-Z]:/Users/)[A-Za-z0-9_.-]+/',
 'sensitive literal':r'(?i)(?:private[_-]?key|seed[_-]?phrase|mnemonic|api[_-]?key|access[_-]?token)\s*[:=]\s*[\x22\x27][A-Za-z0-9+/=_ -]{24,}[\x22\x27]',
}
patterns={k:re.compile(v) for k,v in rules.items()}
bad=[];total=0
allowed_env={'.env.example','.env.testnet.example','.env.snapshot.example'}
for name in filter(None,files):
 path=PurePosixPath(name)
 forbidden=(path.parts[0] in {'node_modules','dist','.vercel','test-results','art','.codex','.agents'}
 or ('Zone.Identifier' in name)
 or (path.name.startswith('.env') and name not in allowed_env)
 or path.suffix.lower() in {'.zip','.7z','.pem','.key','.p12','.pfx','.blend','.blend1','.mp3','.wav','.log','.db'}
 or name.startswith('rattery-'))
 if forbidden:bad.append((name,'excluded artifact'))
 data=subprocess.check_output(['git','show',':'+name]);total+=len(data)
 if len(data)>50*1024*1024:bad.append((name,'oversized file'))
 # Text plus GLB metadata can contain credentials or local paths.
 if path.suffix=='.glb':
  import struct
  size=struct.unpack_from('<I',data,12)[0];data=data[20:20+size]
 elif path.suffix in {'.png','.ttf','.woff','.woff2'}:continue
 text=data.decode('utf-8',errors='replace')
 for label,pattern in patterns.items():
  if pattern.search(text.replace(chr(92),chr(47))):bad.append((name,label))
 if name=='package-lock.json':
  lock=json.loads(text)
  for info in lock.get('packages',{}).values():
   url=info.get('resolved','')
   if url and not url.startswith('https://registry.npmjs.org/'):
    bad.append((name,'non-registry dependency'));break
for name,label in bad:print(name+': '+label)
print(f'Publication scan: {len(list(filter(None,files)))} files, {total} bytes, {len(bad)} findings.')
sys.exit(bool(bad))

#!/usr/bin/env python3
# Fetch a checksum-pinned official scanner; scan only indexed publication files.
import hashlib,io,os,subprocess,tarfile,tempfile,urllib.request
from pathlib import Path
VERSION='8.30.1'
SHA256='551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'
URL=f'https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_linux_x64.tar.gz'
with tempfile.TemporaryDirectory(prefix='rattery-secrets-') as directory:
 root=Path(directory)
 with urllib.request.urlopen(URL,timeout=60) as response:
  archive=response.read(64*1024*1024+1)
 if len(archive)>64*1024*1024 or hashlib.sha256(archive).hexdigest()!=SHA256:
  raise SystemExit('Scanner checksum mismatch; refusing execution')
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as bundle:
  item=bundle.getmember('gitleaks')
  if not item.isfile():raise SystemExit('Unexpected scanner archive')
  executable=root/'gitleaks';executable.write_bytes(bundle.extractfile(item).read());executable.chmod(0o700)
 source=root/'source';source.mkdir()
 subprocess.run(['git','checkout-index','--all','--prefix='+str(source)+'/'],check=True)
 # Redaction keeps secret contents out of CI logs. No report is uploaded.
 result=subprocess.run([str(executable),'dir',str(source),'--redact','--no-banner'],check=False)
 raise SystemExit(result.returncode)

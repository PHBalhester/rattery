#!/usr/bin/env python3
import hashlib,io,json,os,subprocess,tarfile,tempfile,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
VERSION='5.5.0'
SHA256='83b90a05c1540ef1390db1cd5711e5fd04be9c1d8537fb84d39d02092d6a8dff'
URL=f'https://github.com/ossf/scorecard/releases/download/v{VERSION}/scorecard_{VERSION}_linux_amd64.tar.gz'
target=ROOT/'test-results/scorecard'
target.mkdir(parents=True,exist_ok=True)
# Only the intended GitHub repository is queried with the existing credential.
env=dict(os.environ)
env['GITHUB_AUTH_TOKEN']=subprocess.check_output(['gh','auth','token'],text=True).strip()
with tempfile.TemporaryDirectory(prefix='rattery-scorecard-') as directory:
 with urllib.request.urlopen(URL,timeout=60) as response:
  data=response.read(128*1024*1024+1)
 if len(data)>128*1024*1024 or hashlib.sha256(data).hexdigest()!=SHA256:
  raise SystemExit('Checksum mismatch; refusing execution')
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
  member=next(m for m in archive.getmembers() if m.name.split('/')[-1]=='scorecard' and m.isfile())
  binary=Path(directory)/'scorecard'
  binary.write_bytes(archive.extractfile(member).read());binary.chmod(0o700)
 output=target/'latest.json'
 result=subprocess.run([str(binary),'--repo=github.com/PHBalhester/rattery','--format=json','--show-details','--output='+str(output)],env=env,capture_output=True,text=True,timeout=240)
 if result.returncode:raise SystemExit('Scorecard failed; no credentials or raw logs were printed.')
 report=json.loads(output.read_text())
 print('OpenSSF Scorecard:',report.get('score'),'/10')
 for check in report.get('checks',[]):
  print(check['name'],check['score'],check.get('reason',''))
 print('Local report:',output)

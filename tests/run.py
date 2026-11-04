"""HTTP integration checks using Laragon PHP/MySQL. Only a temporary test DB is changed."""
from pathlib import Path
import argparse
import csv
import datetime
import http.cookiejar
import io
import json
import os
import re
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PHP = Path(r'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe')
parser = argparse.ArgumentParser()
parser.add_argument('--php', default=str(DEFAULT_PHP) if DEFAULT_PHP.exists() else 'php')
args = parser.parse_args()
env = dict(os.environ, DH_DB_DATABASE='dh_fleetsync_test_' + secrets.token_hex(6))
checks = []
new_uploads = set()


def check(condition, name):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)


def php(*parts):
    return subprocess.check_output([args.php, *parts], cwd=ROOT, env=env, text=True)


def stats():
    return json.loads(php('tests/database.php'))


class Client:
    def __init__(self, base):
        self.base = base
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, page='lineup', data=None, files=None, **query):
        url = self.base + '/index.php?' + urllib.parse.urlencode(dict(page=page, **query))
        headers = {}
        payload = None
        if files is not None:
            boundary = 'FleetBoundary' + secrets.token_hex(10)
            body = []
            for key, value in (data or {}).items():
                body.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
            for key, (name, mime, content) in files.items():
                body += [f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode(), content, b'\r\n']
            body.append(f'--{boundary}--\r\n'.encode())
            payload = b''.join(body)
            headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary
        elif data is not None:
            payload = urllib.parse.urlencode(data).encode()
        request = urllib.request.Request(url, payload, headers)
        try:
            response = self.opener.open(request, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        content = response.read()
        return response.status, content, response.geturl(), response.headers

    def token(self, page='lineup', **query):
        status, content, _, _ = self.request(page, **query)
        assert status == 200, content.decode()[:500]
        return re.search(rb'name="csrf" value="([a-f0-9]+)"', content)[1].decode()


def table_rows(content):
    return content.decode().count('<tr><td')


def csv_bytes(rows):
    stream = io.StringIO(newline='')
    csv.writer(stream).writerows(rows)
    return stream.getvalue().encode('utf-8-sig')


log = tempfile.TemporaryFile()
server = None
try:
    first = php('backend/cli/install.php')
    second = php('backend/cli/install.php')
    check('53 data awal' in first and '0 data awal' in second, 'installer is idempotent')
    check(stats() == {'lineups': 53, 'operators': 49, 'users': 0, 'audit_logs': 53, 'proofs': 102}, '53 source rows, 49 operators and 102 proofs preserved')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    server = subprocess.Popen([args.php, '-d', 'upload_max_filesize=10M', '-d', 'post_max_size=24M', '-S', f'127.0.0.1:{port}', '-t', 'public'], cwd=ROOT, env=env, stdout=log, stderr=log)
    client = Client(base)
    for _ in range(50):
        try:
            status, content, location, _ = client.request()
            break
        except (urllib.error.URLError, ConnectionError):
            time.sleep(.1)
    check('page=setup' in location, 'first-run setup appears')
    check(client.request('setup', {'csrf': 'invalid'})[0] == 419, 'CSRF enforced before setup')
    token = client.token('setup')
    account = {'csrf': token, 'name': 'Integration Test', 'username': 'integration', 'password': 'LocalTest-' + secrets.token_hex(8)}
    account['password_confirmation'] = account['password']
    check(client.request('setup', account)[0] == 200 and stats()['users'] == 1, 'first account created with login session')
    check('page=lineup' in client.request('setup')[2], 'setup closed after first account')
    token = client.token()
    check(table_rows(client.request()[1]) == 53, 'all seed lineups rendered')
    check(table_rows(client.request(site='ACP')[1]) == 0, 'empty district filter')
    check(table_rows(client.request(shift='D')[1]) == 0, 'shift filter does not fabricate source classifications')
    check(table_rows(client.request(search="' OR 1=1 --")[1]) == 0, 'SQL-like search stays literal')
    check(client.request(site='INVALID')[0] == 422, 'server validates district')
    check(client.request(work_date='2026-02-31')[0] == 422, 'server validates dates')
    for page in ['dashboard', 'master', 'dokumentasi', 'audit', 'import', 'lineup-form', 'operator-form']:
        check(client.request(page)[0] == 200, page + ' renders')
    check(client.request('detail', id='src-7')[0] == 200, 'source detail renders')
    check(client.request(asset='evidence/007_K.png')[3]['Content-Type'] == 'image/png', 'source evidence served through authenticated route')
    check(client.request(asset='../backend/config/app.php')[0] == 404, 'asset traversal rejected')
    check(client.request('lineup-delete', id='src-7')[0] == 405, 'GET cannot delete data')

    row = dict(csrf=token, id='', version=0, site='ACP', work_date='2026-11-03', shift='D', type_category='Production', unit='QA-UNIT', equipment='CAT 777', operator_name='<script>alert(1)</script>', nik='00001234', dh='Ya', mine='Tidak', ftw='Belum dicek', source_status='', note='uji integrasi')
    image = (ROOT / 'frontend/assets/evidence/007_K.png').read_bytes()
    status, content, location, _ = client.request('lineup-save', row, {'proof_ftw': ('proof.png', 'image/png', image)})
    check(status == 200 and 'page=detail' in location and stats()['lineups'] == 54, 'lineup create committed with uploaded proof')
    lineup_id = urllib.parse.parse_qs(urllib.parse.urlsplit(location).query)['id'][0]
    proof_id = re.search(rb'page=media&amp;id=([a-f0-9]+\.png)', content)[1].decode()
    new_uploads.add(proof_id)
    check(b'&lt;script&gt;alert(1)&lt;/script&gt;' in content and b'<script>alert(1)</script>' not in content, 'stored input escaped as HTML')
    check(client.request('media', id=proof_id)[1] == image, 'uploaded image bytes survive round trip')
    row.update(id=lineup_id, version=1, mine='Ya', ftw='Ya', shift='N', type_category='Support')
    check(b'SESUAI' in client.request('lineup-save', row)[1], 'lineup edit updates status, shift and category')
    check(client.request('lineup-save', dict(row, note='stale write'))[0] == 409, 'stale edit rejected with optimistic locking')
    check(b'stale write' not in client.request('detail', id=lineup_id)[1], 'stale edit never overwrites latest row')
    check(client.request('lineup-save', dict(row, id='', version=0))[0] == 409, 'duplicate assignment rejected')
    check(client.request('lineup-save', dict(row, id='', unit='BAD-IMAGE'), {'proof_ftw': ('bad.jpg', 'image/jpeg', b'<?php echo 1; ?>')})[0] == 422, 'fake image upload rejected')
    check(client.request('lineup-save', dict(row, id='', unit='BAD-STATUS', mine='invalid'))[0] == 422, 'invalid status rejected')

    operator = dict(csrf=token, id='', version=0, site='KCP', name='Uji Operator', nik='00005555', unit='QA-OP', equipment='Dozer', last_date='2026-11-03')
    status, content, _, _ = client.request('operator-save', operator)
    check(status == 200 and b'00005555' in content, 'operator create retains leading-zero NIK')
    match = re.search(rb'page=operator-form&amp;id=(\d+)"', content)
    operator_id = match[1].decode()
    operator.update(id=operator_id, version=1, name='Uji Operator Edit')
    check(b'Uji Operator Edit' in client.request('operator-save', operator)[1], 'operator update persisted')
    check(client.request('operator-save', dict(operator, id='', version=0))[0] == 409, 'duplicate site/NIK master rejected')
    check(client.request('operator-delete', dict(csrf=token, id=operator_id, version=2))[0] == 200, 'unassigned master operator can be deleted')
    source_master = client.request('master')[1]
    source_id = re.search(rb'page=operator-form&amp;id=(\d+)"', source_master)[1].decode()
    source_form = client.request('operator-form', id=source_id)[1]
    version = re.search(rb'name="version" value="(\d+)"', source_form)[1].decode()
    check(client.request('operator-delete', dict(csrf=token, id=source_id, version=version))[0] == 409, 'operator with lineup history protected from deletion')

    status, xlsx, _, _ = client.request('export')
    with zipfile.ZipFile(io.BytesIO(xlsx)) as archive:
        sheet = archive.read('xl/worksheets/sheet1.xml')
        check(b'inlineStr' in sheet and b'Mine Dispatch' in sheet, 'real XLSX package contains text cells and source columns')
    before = stats()['lineups']
    status, content, _, _ = client.request('import', dict(csrf=token), {'spreadsheet': ('roundtrip.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsx)})
    check(status == 200 and stats()['lineups'] == before and b'duplikat dilewati' in content, 'XLSX export/import round trip skips existing rows')
    headers = ['Tanggal', 'Site', 'Shift', 'Type', 'Kode Alat', 'Jenis Alat', 'Nama Operator', 'NIK Operator', 'DH Line Up', 'Mine Dispatch', 'FTW Terisi', 'Status Sumber', 'Catatan']
    imported = ['2026-11-03', 'SSCP', 'D', 'Production', 'QA-IMPORT', 'DT', 'Operator CSV', '00000099', 'Ya', 'Ya', 'Ya', 'Sumber uji', 'uji impor']
    payload = csv_bytes([headers, imported, imported])
    status, content, _, _ = client.request('import', dict(csrf=token), {'spreadsheet': ('data.csv', 'text/csv', payload)})
    check(status == 200 and stats()['lineups'] == before + 1 and b'1 data ditambahkan, 1 duplikat' in content, 'CSV imports one row and skips in-file duplicate')
    check(b'00000099' in client.request(site='SSCP')[1] and b'SESUAI' in client.request(site='SSCP')[1], 'CSV statuses and leading-zero NIK retained')
    bad = imported.copy(); bad[4] = 'QA-ROLLBACK'; bad[0] = '2026-02-31'
    good = imported.copy(); good[4] = 'QA-NO-PARTIAL'
    status = client.request('import', dict(csrf=token), {'spreadsheet': ('bad.csv', 'text/csv', csv_bytes([headers, good, bad]))})[0]
    check(status == 422 and stats()['lineups'] == before + 1, 'invalid import rolls back entire batch')
    check(client.request('import', dict(csrf=token), {'spreadsheet': ('legacy.xls', 'application/vnd.ms-excel', b'fake')})[0] == 422, 'legacy XLS gives explicit conversion error')
    evil_zip = io.BytesIO()
    with zipfile.ZipFile(evil_zip, 'w') as archive:
        archive.writestr('xl/workbook.xml', '<!DOCTYPE workbook [<!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">]><workbook>&xxe;</workbook>')
    check(client.request('import', dict(csrf=token), {'spreadsheet': ('xxe.xlsx', 'application/zip', evil_zip.getvalue())})[0] == 422, 'XLSX external entities rejected')

    blank_defaults = imported.copy()
    blank_defaults[1:5] = ['', '', '', 'QA-DEFAULTS']
    check(client.request('import', dict(csrf=token), {'spreadsheet': ('defaults.csv', 'text/csv', csv_bytes([headers, blank_defaults]))})[0] == 200, 'blank template site/shift/type use documented defaults')
    check(table_rows(client.request(search='QA-DEFAULTS', shift='Belum ditentukan', type_category='Belum diklasifikasi')[1]) == 1, 'default import values persisted without guessed classification')
    shared_row = imported.copy()
    shared_row[1] = 'KCP'; shared_row[4] = 'QA-SHARED-XLSX'
    shared_strings = headers + shared_row
    fixture = io.BytesIO()
    serial = (datetime.date(2026, 11, 3) - datetime.date(1904, 1, 1)).days
    rows_xml = '<row r="1">' + ''.join(f'<c r="{chr(65+i)}1" t="s"><v>{i}</v></c>' for i in range(13)) + '</row>'
    rows_xml += '<row r="2">' + ''.join(f'<c r="{chr(65+i)}2"' + (f'><v>{serial}</v></c>' if i == 0 else f' t="s"><v>{13+i}</v></c>') for i in range(13)) + '</row>'
    with zipfile.ZipFile(io.BytesIO(xlsx)) as original, zipfile.ZipFile(fixture, 'w') as archive:
        for name in original.namelist():
            value = original.read(name)
            if name == 'xl/workbook.xml':
                value = value.replace(b'<sheets>', b'<workbookPr date1904="1"/><sheets>')
            elif name == 'xl/worksheets/sheet1.xml':
                value = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows_xml + '</sheetData></worksheet>').encode()
            archive.writestr(name, value)
        archive.writestr('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + ''.join('<si><t>' + escape(v) + '</t></si>' for v in shared_strings) + '</sst>')
    check(client.request('import', dict(csrf=token), {'spreadsheet': ('shared.xlsx', 'application/zip', fixture.getvalue())})[0] == 200, 'XLSX shared strings and 1904 date system supported')
    check(table_rows(client.request(site='KCP', work_date='2026-11-03', search='QA-SHARED-XLSX')[1]) == 1, 'Excel numeric date converted to correct calendar date')

    client2 = Client(base)
    check('page=login' in client2.request()[2], 'new browser must authenticate')
    token2 = client2.token('login')
    check(client2.request('login', dict(csrf=token2, username='integration', password='incorrect'))[0] == 422, 'wrong password rejected')
    check(client2.request('login', dict(csrf=token2, username='integration', password=account['password']))[0] == 200, 'existing account login works')
    check(b'QA-UNIT' in client2.request(site='ACP')[1], 'second browser sees persisted server data')
    check(client.request('lineup-delete', dict(csrf='invalid', id=lineup_id, version=2))[0] == 419, 'CSRF prevents deletion')
    check(client.request('lineup-delete', dict(csrf=token, id=lineup_id, version=2))[0] == 200, 'lineup delete committed')
    check(client.request('detail', id=lineup_id)[0] == 404, 'deleted detail returns 404')
    check(b'create' in client.request('audit')[1] and b'delete' in client.request('audit')[1], 'audit trail records mutations')
    check('page=login' in client.request('logout', dict(csrf=token))[2], 'logout invalidates login session')
    check('page=login' in client.request('media', id=proof_id)[2], 'evidence requires authentication after logout')
    token2 = client2.token()
    check(client2.request('lineup-delete', dict(csrf=token2, id='src-7', version=1))[0] == 200, 'source row can be explicitly deleted in isolated test database')
    after_delete = stats()['lineups']
    check('0 data awal' in php('backend/cli/install.php') and stats()['lineups'] == after_delete and client2.request('detail', id='src-7')[0] == 404, 'reinstall does not restore deleted source or reset edits')
    check(client2.request('profile')[0] == 200 and client2.request('accounts')[0] == 200, 'authenticated profile and account pages render')
    check(client2.request('profile-save')[0] == 405 and client2.request('account-create')[0] == 405, 'account mutations require POST')
    check(client2.request('profile-save', dict(csrf='invalid', name='No', username='nope'))[0] == 419, 'profile requires CSRF')
    check(client2.request('profile-save', dict(csrf=token2, id=9999, name='Updated Name', username='integration'))[0] == 200, 'profile updates session account and ignores posted ID')
    check(b'Updated Name' in client2.request('profile')[1], 'updated name appears in profile and header')
    new_account = dict(csrf=token2, name='Second Operator', username='second.operator', password='Second-Password-123', password_confirmation='Second-Password-123', current_password='wrong')
    check(client2.request('account-create', new_account)[0] == 422 and stats()['users'] == 1, 'creating account requires current password')
    new_account['current_password'] = account['password']
    new_account['password_confirmation'] = 'mismatch'
    check(client2.request('account-create', new_account)[0] == 422 and stats()['users'] == 1, 'account password confirmation enforced')
    new_account['password_confirmation'] = new_account['password']
    check(client2.request('account-create', new_account)[0] == 200 and stats()['users'] == 2, 'new account created without replacing current session')
    check(b'Updated Name' in client2.request('profile')[1], 'creator remains logged into own account')
    check(client2.request('account-create', new_account)[0] == 409 and stats()['users'] == 2, 'duplicate username fails atomically')
    check(client2.request('profile-save', dict(csrf=token2, name='Conflicting', username='second.operator'))[0] == 409, 'profile cannot take another username')
    check(b'Updated Name' in client2.request('profile')[1], 'conflicting profile change is rolled back')
    colleague = Client(base)
    colleague_token = colleague.token('login')
    check(colleague.request('login', dict(csrf=colleague_token, username='second.operator', password=new_account['password']))[0] == 200, 'new account can login')
    colleague_token = colleague.token()
    check(colleague.request('lineup-form')[0] == 200 and colleague.request('accounts')[0] == 200, 'new account receives same operational and account permissions')
    third = dict(new_account, csrf=colleague_token, name='Third Operator', username='third.operator', current_password=new_account['password'])
    check(colleague.request('account-create', third)[0] == 200 and stats()['users'] == 3, 'new account can create another equal-role account')
    audit = colleague.request('audit')[1]
    check(b'account_create' in audit and b'profile_update' in audit and new_account['password'].encode() not in audit, 'audit records account changes without passwords')
    font_status, font, _, font_headers = client2.request(asset='fonts/tt-firs-neue-bold.ttf')
    check(font_status == 200 and font_headers['Content-Type'] == 'font/ttf' and font == (ROOT / 'frontend/assets/fonts/tt-firs-neue-bold.ttf').read_bytes(), 'supplied font is served intact with correct MIME')
    check(client2.request(asset='js/theme.js')[0] == 200, 'theme initialization asset is served')
    check('page=login' in Client(base).request('accounts')[2], 'account list requires authentication')
    denied_account = dict(new_account, username='blocked.operator', current_password='wrong-password')
    denied_statuses = [client2.request('account-create', denied_account)[0] for _ in range(6)]
    check(denied_statuses == [422, 422, 422, 422, 422, 429] and stats()['users'] == 3, 'account creation verification throttles after five failures')
    locked_client = Client(base)
    lock_token = locked_client.token('login')
    attempts = [locked_client.request('login', dict(csrf=lock_token, username='integration', password='wrong-password'))[0] for _ in range(6)]
    check(attempts == [422, 422, 422, 422, 422, 429], 'login locks after five failed attempts')
    check(locked_client.request('login', dict(csrf=lock_token, username='integration', password=account['password']))[0] == 429, 'login lock also applies to a valid password during cooldown')
    print(f'\n{len(checks)} integration checks passed using PHP {php("-r", "echo PHP_VERSION;")} and isolated database {env["DH_DB_DATABASE"]}.')
finally:
    if server:
        server.terminate()
        server.wait(timeout=10)
    try:
        php('tests/database.php', 'cleanup')
    finally:
        for name in new_uploads:
            path = ROOT / 'storage/uploads' / name
            if re.fullmatch(r'[a-f0-9]{48}\.png', name):
                path.unlink(missing_ok=True)
        log.close()

"""App Store signing for CI, made fresh through the App Store Connect API: no Mac, no registered devices.

  python ci-signing.py setup <key.p8> <key_id> <issuer> <out_dir> <run_id> <bundle_id>...
    Creates an Apple Distribution certificate (private key generated here), then one App Store
    provisioning profile per bundle ID. Writes signing.p12 (+ password) and the profiles to out_dir,
    installs the profiles for Xcode, and prints "bundle_id=profile name" lines.

Certificates made by earlier runs are rotated out at the start of the next run (keeping the newest),
so nothing is revoked right after an upload and the account never hits Apple's certificate limit.
Only App Store profiles this script named ("CI ...") are ever deleted.
"""
import base64, json, os, secrets, sys, time, urllib.error, urllib.request
import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

API = 'https://api.appstoreconnect.apple.com/v1'


def token(key, key_id, issuer):
    now = int(time.time())
    return jwt.encode({'iss': issuer, 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'}, key,
                      algorithm='ES256', headers={'kid': key_id, 'typ': 'JWT'})


def call(tok, method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors='replace')
        sys.exit(f'App Store Connect API {method} {path.split("?")[0]} failed ({e.code}): {detail[:600]}')


def setup(keyfile, key_id, issuer, out, run_id, *bundles):
    tok = token(open(keyfile).read(), key_id, issuer)
    os.makedirs(out, exist_ok=True)

    # Old CI profiles first (they point at certificates we may revoke), then rotate certificates.
    for p in call(tok, 'GET', '/profiles?limit=200&fields[profiles]=name')['data']:
        if p['attributes']['name'].startswith('CI '):
            call(tok, 'DELETE', f'/profiles/{p["id"]}')
    certs = [c for c in call(tok, 'GET', '/certificates?limit=200')['data']
             if c['attributes']['certificateType'] in ('DISTRIBUTION', 'IOS_DISTRIBUTION')]
    certs.sort(key=lambda c: c['attributes'].get('expirationDate') or '')
    for c in certs[:-1]:  # keep only the newest, so the new one fits under Apple's limit
        call(tok, 'DELETE', f'/certificates/{c["id"]}')
        print('rotated out an older distribution certificate')

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    csr = x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, 'Wholl CI'), x509.NameAttribute(NameOID.COUNTRY_NAME, 'TR')])
    ).sign(key, hashes.SHA256())
    pem = csr.public_bytes(serialization.Encoding.PEM).decode()
    cert = call(tok, 'POST', '/certificates', {'data': {'type': 'certificates', 'attributes': {
        'certificateType': 'DISTRIBUTION', 'csrContent': pem}}})['data']
    der = base64.b64decode(cert['attributes']['certificateContent'])
    pw = secrets.token_hex(16)
    enc = (serialization.PrivateFormat.PKCS12.encryption_builder().kdf_rounds(50000)
           .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC).hmac_hash(hashes.SHA1()).build(pw.encode()))
    p12 = pkcs12.serialize_key_and_certificates(b'Wholl CI', key, x509.load_der_x509_certificate(der), None, enc)
    open(os.path.join(out, 'signing.p12'), 'wb').write(p12)
    open(os.path.join(out, 'signing.pw'), 'w').write(pw)

    dirs = [os.path.expanduser('~/Library/MobileDevice/Provisioning Profiles'),
            os.path.expanduser('~/Library/Developer/Xcode/UserData/Provisioning Profiles')]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    for bid in bundles:
        found = [b for b in call(tok, 'GET', f'/bundleIds?filter[identifier]={bid}&limit=50')['data']
                 if b['attributes']['identifier'] == bid]
        if not found:
            sys.exit(f'No App ID "{bid}" on this team. Create it under Certificates, IDs & Profiles → Identifiers.')
        name = f'CI {bid} {run_id}'
        prof = call(tok, 'POST', '/profiles', {'data': {'type': 'profiles',
            'attributes': {'name': name, 'profileType': 'IOS_APP_STORE'},
            'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': found[0]['id']}},
                              'certificates': {'data': [{'type': 'certificates', 'id': cert['id']}]}}}})['data']
        content = base64.b64decode(prof['attributes']['profileContent'])
        for d in dirs:
            open(os.path.join(d, prof['attributes']['uuid'] + '.mobileprovision'), 'wb').write(content)
        print(f'{bid}={name}')


if __name__ == '__main__':
    if len(sys.argv) < 8 or sys.argv[1] != 'setup':
        sys.exit(__doc__)
    setup(*sys.argv[2:])

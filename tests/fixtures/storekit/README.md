Throwaway certificates and keys for `tests/subscriptions.test.ts`, shaped like Apple's App Store signing chain
(root → intermediate with OID 1.2.840.113635.100.6.2.1 → leaf with 1.2.840.113635.100.6.11.1), made with openssl.
They are trusted only by the tests; production code trusts Apple Root CA - G3 alone. `plain.*` is a leaf without
the App Store marker. `*.pem` is gitignored, so these were added with `git add -f`.

/**
 * Verifies data signed by the App Store: StoreKit 2 transactions and renewal info, and App Store Server
 * Notifications v2. Each is a JWS (ES256) whose header carries the signing certificate chain (x5c):
 * leaf → Apple intermediate → Apple Root CA - G3.
 *
 * We check, as Apple's own server library does:
 * - the chain ends in Apple's root (byte for byte), each certificate is signed by the next and valid at the
 *   time the data was signed, the intermediate is a CA and carries Apple's WWDR marker (1.2.840.113635.100.6.2.1),
 *   and the leaf carries the App Store receipt-signing marker (1.2.840.113635.100.6.11.1);
 * - the JWS signature with the leaf's key.
 * Anything wrong throws "invalid"; the payload is returned only when everything holds.
 */
import { verify, X509Certificate } from "node:crypto";
import { AppError } from "./errors";

/** Apple Root CA - G3 (https://www.apple.com/certificateauthority/), SHA-256 63:34:3A:BF:…:3E:91:79. */
export const APPLE_ROOT_CA_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

/** DER encodings of Apple's marker extensions' OIDs. */
const OID_WWDR_INTERMEDIATE = Buffer.from("060a2a864886f76364060201", "hex");
const OID_RECEIPT_SIGNING = Buffer.from("060a2a864886f76364060b01", "hex");

let defaultRoots: X509Certificate[] | undefined;
const appleRoots = () => (defaultRoots ??= [new X509Certificate(APPLE_ROOT_CA_G3)]);

export type JwsOptions = {
  /** Trusted roots. Apple's root unless a test passes its own. */
  roots?: X509Certificate[];
  /** Used when the payload has no signedDate. */
  now?: Date;
};

const bad = () => new AppError("invalid", "The App Store data couldn’t be verified.");

/** Verifies an App Store JWS and returns its payload. */
export function verifyAppStoreJws<T extends object>(jws: string, opts: JwsOptions = {}): T {
  if (typeof jws !== "string" || jws.length > 20_000) throw bad();
  const parts = jws.split(".");
  if (parts.length !== 3) throw bad();
  let header: { alg?: string; x5c?: unknown };
  let payload: T & { signedDate?: number };
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    throw bad();
  }
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw bad();
  if (!payload || typeof payload !== "object") throw bad();

  let chain: X509Certificate[];
  try {
    chain = header.x5c.map((c) => {
      if (typeof c !== "string") throw bad();
      return new X509Certificate(Buffer.from(c, "base64"));
    });
  } catch {
    throw bad();
  }
  const [leaf, intermediate, root] = chain;
  const roots = opts.roots ?? appleRoots();
  if (!roots.some((r) => r.raw.equals(root.raw))) throw bad();

  const at = typeof payload.signedDate === "number" ? new Date(payload.signedDate) : (opts.now ?? new Date());
  const validAt = (c: X509Certificate) => new Date(c.validFrom) <= at && at <= new Date(c.validTo);
  if (!chain.every(validAt)) throw bad();
  if (!intermediate.ca || leaf.ca) throw bad();
  if (!intermediate.checkIssued(root) || !intermediate.verify(root.publicKey)) throw bad();
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) throw bad();
  if (!intermediate.raw.includes(OID_WWDR_INTERMEDIATE) || !leaf.raw.includes(OID_RECEIPT_SIGNING)) throw bad();

  const ok = verify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(parts[2], "base64url"),
  );
  if (!ok) throw bad();
  return payload;
}

/** The fields of a signed transaction (JWSTransactionDecodedPayload) that we use. Dates are in milliseconds. */
export type TransactionPayload = {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  type: string;
  purchaseDate: number;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment: string;
  offerType?: number;
  offerDiscountType?: string;
  signedDate?: number;
};

/** The fields of signed renewal info (JWSRenewalInfoDecodedPayload) that we use. */
export type RenewalPayload = {
  originalTransactionId: string;
  autoRenewStatus?: number;
  gracePeriodExpiresDate?: number;
  signedDate?: number;
};

/** An App Store Server Notification v2 (responseBodyV2DecodedPayload). */
export type NotificationPayload = {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
  signedDate?: number;
};

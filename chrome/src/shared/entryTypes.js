/**
@license
Copyright (c) 2025 trading_peter
*/

// Shared entry-type catalog. One source of truth for the entry-type constants,
// the default payload shape per type, and the metadata used to render type
// pickers, badges, and icons.
//
// The backend's validate:"oneof=..." tag in apps/secrets/types/types.go and
// apps/secrets/entryHandlers.go is the authoritative list; this file mirrors
// it. Keep them in sync when adding a type.

export const ENTRY_TYPES = Object.freeze([
  {
    id: 'login',
    label: 'Login',
    icon: 'user',
    description: 'Username + password + URL + optional TOTP. The standard credential.',
  },
  {
    id: 'mnemonic',
    label: 'Mnemonic Seed',
    icon: 'wallet',
    description: 'BIP39 seed phrase with optional passphrase and derivation paths.',
  },
  {
    id: 'apiKey',
    label: 'Exchange API Key',
    icon: 'key',
    description: 'Exchange key + secret + user-declared scopes (read/trade/withdraw).',
  },
  {
    id: 'privateKey',
    label: 'EVM Private Key',
    icon: 'key',
    description: 'Raw private key or encrypted keystore JSON for an EVM chain.',
  },
  {
    id: 'contract',
    label: 'Contract Address',
    icon: 'file',
    description: 'Address + optional encrypted ABI for an on-chain contract.',
  },
  {
    id: 'backupCodes',
    label: '2FA Backup Codes',
    icon: 'lock',
    description: 'Structured backup code list with mark-as-used tracking.',
  },
]);

export const TYPE_IDS = ENTRY_TYPES.map(t => t.id);

export function typeMeta(typeId) {
  return ENTRY_TYPES.find(t => t.id === typeId) || null;
}

// Default payload for a freshly-created entry of the given type. The editor
// fills these in; the detail renderer reads them. Keeping the defaults here
// means every code path agrees on the payload shape from creation onward.
export function defaultPayload(typeId) {
  switch (typeId) {
    case 'login':
      return {
        title: '',
        username: '',
        password: '',
        urls: [],
        totpSecret: '',
        notes: '',
        tags: [],
        customFields: [],
        folderId: null,
      };

    case 'mnemonic':
      return {
        title: '',
        wordCount: 12,
        phrase: '',
        passphrase: '',
        derivationPaths: [],
        notes: '',
        tags: [],
        customFields: [],
        folderId: null,
      };

    case 'apiKey':
      return {
        title: '',
        exchange: '',
        key: '',
        secret: '',
        scopes: [],
        notes: '',
        tags: [],
        customFields: [],
        folderId: null,
      };

    case 'privateKey':
      return {
        title: '',
        subtype: 'privateKey',
        privateKey: '',
        keystore: '',
        address: '',
        chain: 'ethereum',
        derivationPath: '',
        notes: '',
        tags: [],
        customFields: [],
        folderId: null,
      };

    case 'contract':
      return {
        title: '',
        address: '',
        chain: 'ethereum',
        abi: '',
        methods: [],
        notes: '',
        tags: [],
        customFields: [],
        folderId: null,
      };

    case 'backupCodes':
      return {
        title: '',
        service: '',
        codes: [],
        usedFlags: [],
        generatedDate: '',
        expiresAt: '',
        notes: '',
        tags: [],
        customFields: [],
        folderId: null,
      };

    default:
      return { title: '', notes: '', tags: [], folderId: null };
  }
}

// Known exchange presets — used by the apiKey editor's exchange dropdown.
// Adding an exchange here is purely a UI affordance; the user can type any
// value into the field. Order: most common first.
export const EXCHANGE_PRESETS = Object.freeze([
  'bybit',
  'binance',
  'hyperliquid',
  'okx',
  'kraken',
  'bitget',
  'coinbase',
  'kucoin',
  'mexc',
  'deribit',
]);

// Scope presets for the apiKey editor. The user can freeform-add others.
export const SCOPE_PRESETS = Object.freeze(['read', 'trade', 'withdraw']);

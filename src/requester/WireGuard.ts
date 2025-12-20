export async function getConfigPath(providerString: string): Promise<string> {
  const MAX_INTERFACE_LENGTH = 15; // Total max length including wg_ prefix
  const PREFIX = 'wg_';
  const MAX_IDENTIFIER_LENGTH = MAX_INTERFACE_LENGTH - PREFIX.length;

  const providerURL = providerString.split(',')[0];
  let identifier = providerURL
  .replace(/^https?:\/\//, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

  // If doesn't start with letter, add 'wg' but count it towards total length
  if (!/^[a-z]/i.test(identifier)) {
    identifier = 'wg' + identifier;
  }

  // Slice to max allowed length considering prefix
  identifier = identifier.slice(0, MAX_IDENTIFIER_LENGTH);

  // Ensure it doesn't end with a number
  if (/\d$/.test(identifier)) {
    // If at max length, remove last char before adding 'x'
    if (identifier.length >= MAX_IDENTIFIER_LENGTH) {
      identifier = identifier.slice(0, -1);
    }
    identifier += 'x';
  }

  return `/etc/wireguard/${PREFIX}${identifier}.conf`;
}
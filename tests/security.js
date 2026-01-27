import assert from 'assert';

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}:[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:)?[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}::$/;

function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

function escapeLikePattern(search) {
  return search
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

console.log('Running security tests...\n');

console.log('=== IP Validation Tests ===');

const validIPs = [
  '192.168.1.1',
  '10.0.0.1',
  '255.255.255.255',
  '0.0.0.0',
  '127.0.0.1',
  '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
  '::1',
  'fe80::1',
];

const invalidIPs = [
  '',
  null,
  undefined,
  '192.168.1.1; rm -rf /',
  '192.168.1.1 && cat /etc/passwd',
  '192.168.1.1`whoami`',
  '$(whoami)',
  '192.168.1.256',
  '192.168.1',
  '192.168.1.1.1',
  'not-an-ip',
  '192.168.1.1\n127.0.0.1',
  '192.168.1.1|ls',
  '../../../etc/passwd',
  'a'.repeat(100),
];

let passed = 0;
let failed = 0;

for (const ip of validIPs) {
  const result = isValidIP(ip);
  if (result) {
    passed++;
    console.log(`  ✓ Valid IP accepted: ${ip}`);
  } else {
    failed++;
    console.log(`  ✗ Valid IP rejected (FAIL): ${ip}`);
  }
}

for (const ip of invalidIPs) {
  const result = isValidIP(ip);
  if (!result) {
    passed++;
    console.log(`  ✓ Invalid IP rejected: ${String(ip).substring(0, 30)}`);
  } else {
    failed++;
    console.log(`  ✗ Invalid IP accepted (FAIL): ${String(ip).substring(0, 30)}`);
  }
}

console.log('\n=== SQL LIKE Escape Tests ===');

const likeTestCases = [
  { input: 'test', expected: 'test' },
  { input: 'test%', expected: 'test\\%' },
  { input: 'test_name', expected: 'test\\_name' },
  { input: 'test\\path', expected: 'test\\\\path' },
  { input: '%_%\\', expected: '\\%\\_\\%\\\\' },
  { input: '100%', expected: '100\\%' },
  { input: 'user_123', expected: 'user\\_123' },
  { input: 'normal search', expected: 'normal search' },
];

for (const { input, expected } of likeTestCases) {
  const result = escapeLikePattern(input);
  if (result === expected) {
    passed++;
    console.log(`  ✓ LIKE escape: "${input}" -> "${result}"`);
  } else {
    failed++;
    console.log(`  ✗ LIKE escape FAIL: "${input}" -> "${result}" (expected: "${expected}")`);
  }
}

console.log('\n=== Password Strength Tests ===');

const WEAK_PASSWORDS = [
  'password', 'sqlpassword', '123456', 'admin', 'root', 'mysql',
  'secret', 'changeme', 'default', 'test', 'demo', 'example',
];

function isWeakPassword(pw) {
  if (!pw || pw.length < 12) return true;
  const lower = pw.toLowerCase();
  return WEAK_PASSWORDS.some((weak) => lower.includes(weak));
}

const weakPasswords = [
  'password123',
  'sqlpassword',
  'short',
  'admin12345',
  'rootaccess',
  'mysqldb',
  'secret123',
  'changeme!',
  'default99',
  'testtest',
  'demouser',
  'example1',
  '12345678901',
];

const strongPasswords = [
  'Kj8#mP2$vL9@nQ4!',
  'xY7*bN3&hR6^wT1%',
  'correcthorsebatterystaple',
  'randomlongstringhere',
];

for (const pw of weakPasswords) {
  if (isWeakPassword(pw)) {
    passed++;
    console.log(`  ✓ Weak password rejected: ${pw}`);
  } else {
    failed++;
    console.log(`  ✗ Weak password accepted (FAIL): ${pw}`);
  }
}

for (const pw of strongPasswords) {
  if (!isWeakPassword(pw)) {
    passed++;
    console.log(`  ✓ Strong password accepted: ${pw}`);
  } else {
    failed++;
    console.log(`  ✗ Strong password rejected (FAIL): ${pw}`);
  }
}

console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}

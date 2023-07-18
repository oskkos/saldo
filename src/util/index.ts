export function throwUnsupportedEnumMember(val: never) {
  throw new Error('Unsupported enum member: ' + String(val));
}

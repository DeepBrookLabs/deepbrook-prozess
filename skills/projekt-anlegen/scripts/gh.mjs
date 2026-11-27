// Aufrufe der GitHub-CLI für die Board-Skripte.
import { execFileSync } from 'node:child_process';

export function gh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function graphql(query, variables = {}) {
  const out = JSON.parse(gh(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables })));
  if (out.errors) throw new Error(out.errors.map((e) => e.message).join('; '));
  return out.data;
}

// Setzt die Optionen eines Einfachauswahl-Feldes. Optionen mit id bleiben samt Kartenwerten erhalten,
// ohne id entstehen neu, fehlende werden gelöscht.
export function updateOptions(fieldId, options) {
  graphql(
    `mutation($input: UpdateProjectV2FieldInput!) { updateProjectV2Field(input: $input) { clientMutationId } }`,
    { input: { fieldId, singleSelectOptions: options } },
  );
}

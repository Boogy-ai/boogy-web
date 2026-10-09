// ChoiceGroup: one choice of several, each with a label and an optional line
// describing it. A fieldset of native radio inputs, so arrow keys, form
// semantics and the group's name come from the browser.

export interface ChoiceGroupAttrs {
  'data-boogy': 'choice-group';
}

export function choiceGroup(): ChoiceGroupAttrs {
  return { 'data-boogy': 'choice-group' };
}

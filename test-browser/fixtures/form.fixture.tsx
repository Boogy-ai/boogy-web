// A Form of many fields in a column of a given size, with Delete, Cancel and
// Save in its foot.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ActionButton, Form, ImageField, TextField } from '../../preact/index';
import { installFoundation } from '@boogy/web';

/** A 1×1 PNG. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function Fields() {
  const [values, setValues] = useState<string[]>(Array.from({ length: 14 }, (_, i) => `value ${i + 1}`));
  return (
    <Form
      onSubmit={() => {}}
      actions={<><ActionButton kind="cancel" /><ActionButton kind="save" /><ActionButton kind="delete" /></>}
    >
      {/* A padded logo: the image inset in a thumbnail that keeps its size. */}
      <ImageField label="Logo" name="Harbor Lane" src={PIXEL} onPick={() => {}} ground="padded" onGroundChange={() => {}} />
      {values.map((v, i) => (
        <TextField key={i} label={`Field ${i + 1}`} value={v} onValueChange={(nv) => setValues(values.map((x, j) => (j === i ? nv : x)))} />
      ))}
    </Form>
  );
}

(window as unknown as Record<string, unknown>).formFixture = {
  mount(width: number, height: number) {
    installFoundation();
    const root = document.createElement('div');
    root.id = 'R';
    Object.assign(root.style, { width: `${width}px`, height: `${height}px`, display: 'flex', flexDirection: 'column' });
    document.body.appendChild(root);
    render(<Fields />, root);
  },
};

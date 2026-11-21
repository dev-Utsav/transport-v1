import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import type { Strings } from "@/content/strings";

type FieldError = "required" | "invalid" | undefined;

/**
 * Pick a party, or choose "+ New party" and type the name and phone right here (saved with the
 * form). The extra fields show via CSS :has(), so this needs no JS.
 */
export function PartyPicker({
  name,
  label,
  parties,
  v,
  e,
  c,
  newLabel,
}: {
  name: "senderId" | "receiverId";
  label: string;
  parties: { id: number; name: string }[];
  v: (name: string) => string;
  e: (name: string) => FieldError;
  c: Strings["common"];
  newLabel: string;
}) {
  const prefix = name.replace("Id", "");
  return (
    <div data-new-party className="grid gap-3">
      <Field id={name} label={label} error={e(name)} c={c}>
        <SelectInput
          id={name}
          name={name}
          required
          defaultValue={v(name)}
          invalid={Boolean(e(name))}
        >
          <option value="">{c.choose}</option>
          <option value="new">{newLabel}</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div
        data-new-party-fields
        className="grid grid-cols-[1.4fr_1fr] gap-3 rounded-field bg-paper-deep p-3"
      >
        <Field id={`${prefix}NewName`} label={c.name} error={e(`${prefix}NewName`)} c={c}>
          <TextInput
            id={`${prefix}NewName`}
            name={`${prefix}NewName`}
            defaultValue={v(`${prefix}NewName`)}
            invalid={Boolean(e(`${prefix}NewName`))}
          />
        </Field>
        <Field
          id={`${prefix}NewPhone`}
          label={c.phone}
          error={e(`${prefix}NewPhone`)}
          c={c}
          optional
        >
          <TextInput
            id={`${prefix}NewPhone`}
            name={`${prefix}NewPhone`}
            type="tel"
            inputMode="tel"
            defaultValue={v(`${prefix}NewPhone`)}
          />
        </Field>
      </div>
    </div>
  );
}

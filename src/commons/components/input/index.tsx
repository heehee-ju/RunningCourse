import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type HTMLAttributes,
} from 'react';

import { AddtionalText, type AddtionalTextProps, type AddtionalTextState } from './addtional_text';
import { Label, type LabelProps } from './label';
import { Placeholder, type PlaceholderProps } from './placeholder';
import styles from './styles.module.css';

type FieldDerived = {
  invalid: boolean;
  success: boolean;
  disabled: boolean;
};

const defaultFieldDerived: FieldDerived = {
  invalid: false,
  success: false,
  disabled: false,
};

type InputContextValue = {
  inputId: string;
  fieldDerived: FieldDerived;
  updateFieldDerived: (next: FieldDerived) => void;
};

const InputContext = createContext<InputContextValue | null>(null);

function useInputContext(component: string): InputContextValue {
  const ctx = useContext(InputContext);
  if (!ctx) {
    throw new Error(`${component} must be used within Input.Root`);
  }
  return ctx;
}

export type InputRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'id'> & {
  /** `<input>`·`label htmlFor`에 쓰는 id. 미지정 시 `useId` 기반 값 */
  id?: string;
};

function InputRoot({ id: idProp, className, children, ...divProps }: InputRootProps) {
  const uid = useId().replace(/:/g, '');
  const inputId = idProp ?? `input-${uid}`;
  const [fieldDerived, setFieldDerived] = useState<FieldDerived>(defaultFieldDerived);

  const updateFieldDerived = useCallback((next: FieldDerived) => {
    setFieldDerived((prev) =>
      prev.invalid === next.invalid &&
      prev.success === next.success &&
      prev.disabled === next.disabled
        ? prev
        : next,
    );
  }, []);

  const value = useMemo(
    () => ({ inputId, fieldDerived, updateFieldDerived }),
    [inputId, fieldDerived, updateFieldDerived],
  );

  const rootClass = [styles.root, className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} {...divProps}>
      <InputContext.Provider value={value}>{children}</InputContext.Provider>
    </div>
  );
}

export type InputLabelProps = LabelProps;

function InputLabel(props: InputLabelProps) {
  const { htmlFor: htmlForProp, ...rest } = props;
  const { inputId } = useInputContext('Input.Label');
  const htmlFor = htmlForProp ?? inputId;

  return <Label htmlFor={htmlFor} {...rest} />;
}

function readDataStatus(props: PlaceholderProps): string | undefined {
  const r = props as Record<string, unknown>;
  const raw = r['data-status'] ?? r.dataStatus;
  return typeof raw === 'string' ? raw : undefined;
}

export type InputFieldProps = PlaceholderProps;

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(props, ref) {
  const { id: idProp, className, disabled, 'aria-invalid': ariaInvalid, ...rest } = props;
  const { inputId, updateFieldDerived } = useInputContext('Input.Field');
  const id = idProp ?? inputId;

  const dataStatus = readDataStatus(props);
  const invalid = ariaInvalid === true || ariaInvalid === 'true';
  const success = dataStatus === 'success';
  const ariaDisabled = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const disabledField = Boolean(disabled) || ariaDisabled;

  useLayoutEffect(() => {
    updateFieldDerived({ invalid, success, disabled: disabledField });
  }, [invalid, success, disabledField, updateFieldDerived]);

  return (
    <Placeholder
      ref={ref}
      id={id}
      className={className}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      {...rest}
    />
  );
});

export type InputAddtionalTextProps = AddtionalTextProps;

function InputAddtionalText({ state, ...rest }: InputAddtionalTextProps) {
  const ctx = useContext(InputContext);
  const derived = ctx?.fieldDerived;

  const resolvedState: AddtionalTextState =
    state ??
    (derived ? (derived.invalid ? 'error' : derived.success ? 'success' : 'default') : 'default');

  return <AddtionalText state={resolvedState} {...rest} />;
}

/**
 * `label` + `Placeholder`(필드) + `addtional_text` Compound Component.
 * `id`/`htmlFor`는 Root·Field·Label에 넘기지 않으면 Context 기본값으로 연결됩니다.
 */
export const Input = {
  Root: InputRoot,
  Label: InputLabel,
  Field: InputField,
  AddtionalText: InputAddtionalText,
} as const;

export default Input;

export type { AddtionalTextState } from './addtional_text';
export type { LabelType } from './label';
export type { PlaceholderProps } from './placeholder';

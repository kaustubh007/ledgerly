'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type DefaultValues, type FieldValues, type Path } from 'react-hook-form';
import type { z } from 'zod';

export interface ServerUserError {
  readonly code: string;
  readonly field?: readonly string[] | null;
}

/**
 * react-hook-form with the *same* zod schema the API uses (@ledgerly/validation), plus a way to
 * put the server's `userErrors` onto the right fields (`field` is e.g. `['input', 'email']`).
 */
export function useZodForm<T extends FieldValues>(
  schema: z.ZodType<T, T>,
  defaults: DefaultValues<T>,
) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  });

  function applyUserErrors(errors: readonly ServerUserError[]): void {
    const fields = Object.keys(defaults);
    for (const error of errors) {
      const name = error.field?.at(-1);
      if (name && fields.includes(name)) {
        form.setError(
          name as Path<T>,
          { type: error.code.toLowerCase(), message: error.code },
          { shouldFocus: true },
        );
      } else {
        form.setError('root.server', { type: error.code, message: error.code });
      }
    }
  }

  return { ...form, applyUserErrors };
}

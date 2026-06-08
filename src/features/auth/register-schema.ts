import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Informe um e-mail válido'),
  password: z
    .string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter uma letra maiúscula')
    .regex(/[0-9]/, 'A senha deve conter um número'),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

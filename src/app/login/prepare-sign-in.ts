"use server";
import { cookies } from 'next/headers';
import { authDestination } from '@/lib/auth-destination';

export async function prepareSignIn(destination: string) {
  (await cookies()).set('auth-return', authDestination(destination), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600,
  });
}

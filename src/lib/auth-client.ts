"use client";

import { createAuthClient } from "better-auth/react";

// Tanpa baseURL agar request login/daftar selalu memakai origin halaman yang sedang dibuka.
export const authClient = createAuthClient();

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Verify the token with Firebase Admin
    await adminAuth.verifyIdToken(token);

    // Validate token before setting cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    const cookieStore = await cookies();
    cookieStore.set("token", token as string, {
      httpOnly: true,
      maxAge: expiresIn / 1000,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in /api/set-token:", err);
    if (err instanceof SyntaxError) { // Error from req.json()
        return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    // Pass through the actual error message if available, otherwise a generic one
    const errorMessage = err.message || "Internal server error setting token";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

import Image from "next/image";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { sanitizeNextPath } from "@/lib/auth/routes";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

function getCallbackError(errorCode: string | undefined) {
  if (errorCode === "auth_callback_failed") {
    return "Sign-in could not be completed. Please try again.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const callbackError = getCallbackError(params.error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Image
            src="/tw-wordmark.png"
            alt="Thinkway"
            width={180}
            height={36}
            priority
            className="mx-auto mb-2 h-8 w-auto"
          />
          <CardDescription>
            Sign in to manage clients, campaigns, and operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm nextPath={nextPath} callbackError={callbackError} />
        </CardContent>
      </Card>
    </div>
  );
}

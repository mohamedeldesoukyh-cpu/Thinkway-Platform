import { LoginScreen } from "@/features/auth/components/login-screen";
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
    <LoginScreen nextPath={nextPath} callbackError={callbackError} />
  );
}

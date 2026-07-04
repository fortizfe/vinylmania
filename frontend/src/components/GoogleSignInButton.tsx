import { Button } from './ui/Button';

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  error?: string | null;
}

export function GoogleSignInButton({
  onClick,
  loading = false,
  error = null,
}: GoogleSignInButtonProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={onClick} loading={loading} className="rounded-full px-8 py-3.5">
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </Button>
      {error && (
        <p role="alert" className="max-w-96 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

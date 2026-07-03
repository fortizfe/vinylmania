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
    <div className="google-signin">
      <button
        type="button"
        className="google-signin__button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && (
        <p role="alert" className="google-signin__error">
          {error}
        </p>
      )}
    </div>
  );
}

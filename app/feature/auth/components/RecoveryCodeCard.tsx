type RecoveryCodeCardProps = {
  recoveryCode: string;
  pendingLogin: boolean;
  onContinue: () => void;
};

export function RecoveryCodeCard({
  recoveryCode,
  pendingLogin,
  onContinue,
}: RecoveryCodeCardProps) {
  return (
    <>
      <p className="auth-eyebrow">SAVE YOUR RECOVERY CODE</p>
      <h1>Keep this code safe</h1>
      <p className="auth-description">
        Use this code with your username to reset your password if you forget it. It is shown only
        once.
      </p>
      <div className="recovery-code" aria-label="Recovery code">
        {recoveryCode}
      </div>
      <p className="form-error" role="alert">
        Anyone with this code can reset your password and access this local inbox. Store it
        somewhere private.
      </p>
      <button className="primary-button auth-submit" type="button" onClick={onContinue}>
        {pendingLogin ? "Continue to inbox" : "I saved my recovery code"}
      </button>
    </>
  );
}

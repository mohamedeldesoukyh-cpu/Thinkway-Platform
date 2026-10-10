/** Public, data-free feedback while the authorized workspace loads. */
export default function ClientWorkspaceLoading() {
    return <main className="tw-workspace-loading" role="status" aria-live="polite" aria-busy="true">
        <h1>Opening your campaign workspace…</h1>
        <p>Preparing your creators and campaign details.</p>
    </main>;
}

export function resolveFeedbackPresentation(options = {}) {
  if (options.onConfirm || options.onCancel) {
    return 'modal';
  }

  if (options.presentation === 'toast') {
    return 'toast';
  }

  return 'modal';
}

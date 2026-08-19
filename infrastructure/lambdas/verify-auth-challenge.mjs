/**
 * Cognito Lambda: Verify Auth Challenge
 * Checks the OTP the user submitted against what was generated.
 *
 * Deploy: AWS Console → Lambda → Create function
 * Trigger: Cognito User Pool → Verify auth challenge response
 */
export const handler = async (event) => {
  const expected = event.request.privateChallengeParameters.otp;
  const provided  = event.request.challengeAnswer?.trim();

  event.response.answerCorrect = expected === provided;
  return event;
};

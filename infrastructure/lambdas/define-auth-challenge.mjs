/**
 * Cognito Lambda: Define Auth Challenge
 * Controls the custom authentication flow (OTP-only, no password).
 *
 * Deploy: AWS Console → Lambda → Create function
 * Trigger: Cognito User Pool → Define auth challenge
 */
export const handler = async (event) => {
  const session = event.request.session;

  if (session.length === 0) {
    // First call: issue the OTP challenge
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE";
  } else if (
    session.length === 1 &&
    session[0].challengeName === "CUSTOM_CHALLENGE" &&
    session[0].challengeResult === true
  ) {
    // OTP correct: issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    // Wrong OTP or too many attempts
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
};

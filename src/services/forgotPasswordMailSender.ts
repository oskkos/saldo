import Mailjet from 'node-mailjet';
import 'server-only';

export async function sendResetPasswordMail(recipient: string, token: string) {
  const mailjet = Mailjet.apiConnect(
    process.env.MAILJET_API_KEY as string,
    process.env.MAILJET_SECRET_KEY as string,
  );

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: {
          Email: 'saldo@k6.fi',
          Name: 'saldo',
        },
        To: [
          {
            Email: recipient,
          },
        ],
        TemplateID: Number(process.env.MAILJET_RESET_PASSWORD_TEMPLATE_ID),
        TemplateLanguage: true,
        Subject: 'Reset your saldo password',
        Variables: {
          resetpasswordlink: `${process.env.HOST}/reset-password?token=${token}`,
        },
      },
    ],
  });
}

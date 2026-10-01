# Authority Access

## Main-branch setup

Set these server-side environment variables before starting the application:

- `URBANNEX_ADMIN_EMAIL`: the main-branch sign-in email
- `URBANNEX_ADMIN_PASSWORD`: the main-branch password (at least 4 characters)

The server creates or promotes this account as the main-branch authority at startup. Do not expose these values to browser code or commit them. For local development, set them in the server environment before `npm run dev`. On Vercel, configure them as project environment variables and redeploy.

## Password recovery

Passwords must contain at least 4 characters. For email-based recovery and authority notifications, configure `RESEND_API_KEY` and `AUTH_FROM_EMAIL` as server-side environment variables. Set `APP_URL` to the deployed application URL so links point to the right site. Without mail configuration, production password reset is disabled and approval/incident emails are not delivered; the approval screen reports when its email was not sent. Local development returns a one-time reset token in the API response for testing. Reset tokens expire after 30 minutes and are single-use. A successful password reset revokes the account's existing sessions.

When main branch approves an authority, UrbanNex emails the assigned department and login URL, but never emails the account password. Assigned, in-progress, and resolved incident updates are sent to approved authorities in that department with operational incident details.

## Department authority onboarding

1. A department authority signs up and selects the department they are requesting.
2. The account is stored in SQLite as a pending request and cannot sign in yet.
3. Main branch signs in, opens **Authority Access**, selects the department to assign, and approves the request.
4. The department authority can then sign in with the Department desk option.
5. Department authorities receive only incidents assigned to their department. They can move assigned incidents to **In Progress** and resolve incidents already in progress. Main branch retains city-wide fleet, incident, analytics, and system views and controls verification and department assignment.

The API and WebSocket both enforce these rules; hiding a page in the browser is not the security boundary. Existing accounts from earlier versions default to unapproved department accounts. Approve them from main-branch access management, or promote the intended main-branch email through `URBANNEX_ADMIN_EMAIL`.

## GitHub and Vercel updates

The `.github/workflows/deploy-vercel.yml` workflow validates pushes and pull requests targeting `main`. It deploys `main` pushes to Vercel production and pull requests as preview deployments. Add these GitHub Actions repository secrets before merging or pushing code that should deploy:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Configure application variables in Vercel Project Settings, not in GitHub source: `URBANNEX_ADMIN_EMAIL`, `URBANNEX_ADMIN_PASSWORD`, `RESEND_API_KEY`, `AUTH_FROM_EMAIL`, and `APP_URL`. Never commit passwords, API keys, or Vercel tokens. The local `.env` is ignored by Git and is not transferred by the deployment workflow.

## Deployment note

The current application uses a local SQLite database at `urbannex.db`. That is suitable for a single persistent server instance. Serverless deployments with ephemeral filesystems need a persistent/shared database before using this flow across restarts or multiple instances; configure storage accordingly before production use.

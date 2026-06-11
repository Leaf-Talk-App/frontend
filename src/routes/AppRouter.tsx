import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthenticatedShell } from '../components/app-shell/AuthenticatedShell';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { GoogleCallbackPage } from '../features/auth/GoogleCallbackPage';
import { ChatsPage } from '../features/chats/ChatsPage';
import { ChatWindowPage } from '../features/chats/ChatWindowPage';
import { GroupsPage } from '../features/groups/GroupsPage';
import { GroupChatPage } from '../features/groups/GroupChatPage';
import { SearchPage } from '../features/search/SearchPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { AiAssistantPage } from '../features/ai/AiAssistantPage';
import { useAuth } from '../lib/auth/use-auth';
import { routePaths } from './paths';

export function AppRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to={routePaths.login} replace />} />
      <Route path={routePaths.login} element={<LoginPage />} />
      <Route path={routePaths.register} element={<RegisterPage />} />
      <Route path={routePaths.createAccount} element={<RegisterPage />} />
      <Route path={routePaths.verifyEmail} element={<VerifyEmailPage />} />
      <Route path={routePaths.googleCallback} element={<GoogleCallbackPage />} />
      <Route path={routePaths.forgotPassword} element={<ForgotPasswordPage />} />
      <Route path={routePaths.resetPassword} element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AuthenticatedShell />}>
          <Route path={routePaths.chats} element={<ChatsPage />} />
          <Route path={routePaths.chat} element={<ChatWindowPage />} />
          <Route path={routePaths.groups} element={<GroupsPage />} />
          <Route path={routePaths.group} element={<GroupChatPage />} />
          <Route path={routePaths.search} element={<SearchPage />} />
          <Route path={routePaths.assistant} element={<AiAssistantPage />} />
          <Route path={routePaths.profile} element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={routePaths.login} replace />} />
    </Routes>
  );
}

function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={routePaths.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

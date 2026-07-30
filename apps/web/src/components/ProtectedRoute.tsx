import { Center, Group, Loader, Text } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Solo deja pasar si hay usuario autenticado; si no, redirige a /login.
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Este estado intermedio no es decorativo: sin el, al recargar con un token
  // valido se veria un parpadeo hacia /login antes de que responda getMe().
  if (loading) {
    return (
      <Center mih="100dvh">
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Cargando…
          </Text>
        </Group>
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

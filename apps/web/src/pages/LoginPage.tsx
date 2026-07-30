import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Center mih="100dvh" p="md">
      <Paper withBorder radius="lg" p="xl" w="100%" maw={420} shadow="sm">
        <Stack gap="lg">
          <Stack gap={4} align="center">
            <Title order={1} fz="2rem" c="brand">
              DTNotes
            </Title>
            <Text size="sm" c="dimmed">
              Inicia sesión en tu cuenta
            </Text>
          </Stack>

          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <PasswordInput
                label="Contraseña"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />

              {error && (
                <Alert
                  variant="light"
                  color="red"
                  icon={<IconAlertCircle size={16} />}
                  radius="md"
                  p="xs"
                >
                  <Text size="sm">{error}</Text>
                </Alert>
              )}

              <Button type="submit" loading={submitting} fullWidth>
                Entrar
              </Button>
            </Stack>
          </form>

          <Text size="sm" c="dimmed" ta="center">
            ¿No tienes cuenta?{' '}
            <Anchor component={Link} to="/register" size="sm">
              Regístrate
            </Anchor>
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}

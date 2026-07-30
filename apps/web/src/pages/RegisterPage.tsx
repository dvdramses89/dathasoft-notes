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

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
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
              Crea tu cuenta
            </Text>
          </Stack>

          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <TextInput
                label="Nombre"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
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
                minLength={8}
                autoComplete="new-password"
                description="Mínimo 8 caracteres"
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
                Crear cuenta
              </Button>
            </Stack>
          </form>

          <Text size="sm" c="dimmed" ta="center">
            ¿Ya tienes cuenta?{' '}
            <Anchor component={Link} to="/login" size="sm">
              Inicia sesión
            </Anchor>
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}

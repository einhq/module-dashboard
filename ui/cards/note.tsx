import { Box } from '@mantine/core';
import { Markdown } from '@ein/ui/components';
import { useSearchParams } from 'react-router-dom';
import '../dashboard.css';

/** `/cards/dashboard/note`: a few words of the dashboard's maker, in Markdown, sized to its tile. */
export default function NoteCard() {
  const [params] = useSearchParams();
  return (
    <Box h='100%' style={{ overflow: 'auto', fontSize: 'clamp(0.9rem, 5.5cqmin, 2rem)', lineHeight: 1.45 }}>
      <Markdown content={params.get('text') ?? ''} />
    </Box>
  );
}

/**
 * Part of the physician dashboard — the "Compare versions" popup:
 * the current Course in the Ward beside its earlier texts, with the words each
 * one changes highlighted, so the physician can pick the one to keep.
 */

import { useEffect, useState } from 'react';
import { courseInWardApi } from '../../services/domainApi';
import { InfoTooltip, Modal } from '../../components/ui';
import type { CourseInWard, SummaryStatus, SummaryVersion } from '../../types';
import { AiActionButton } from '../../components/ai/AiSummaryCard';
import { HighlightedSummary, SummaryComposition } from '../../components/ai/SummaryComposition';
import { manage } from './styles';

const SOURCE_LABEL: Record<SummaryStatus, string> = {
  DRAFT_AI: 'AI draft',
  DRAFT_EDITED: 'Edited',
  APPROVED: 'Approved',
};

/**
 * Splits `text` into words and the whitespace between them, flagging the words
 * that are not part of the longest common word sequence with `base`.
 */
function diffWords(base: string, text: string): { token: string; changed: boolean }[] {
  const tokens = text.split(/(\s+)/).filter(Boolean);
  const a = base.split(/\s+/).filter(Boolean);
  const b = tokens.filter((token) => !/^\s+$/.test(token));
  // ponytail: O(n·m) LCS table; fine for 5-sentence summaries, swap for Myers if texts grow.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const kept = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      kept.add(j);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }

  let word = 0;
  return tokens.map((token) =>
    /^\s+$/.test(token) ? { token, changed: false } : { token, changed: !kept.has(word++) },
  );
}

interface SummaryHistoryProps {
  summary: CourseInWard;
  onRestored: (updated: CourseInWard) => void;
  onClose: () => void;
}

export function SummaryHistory({ summary, onRestored, onClose }: SummaryHistoryProps) {
  const [versions, setVersions] = useState<SummaryVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  /** The in-use card's composition is open, so its order keywords are highlighted. */
  const [showKeywords, setShowKeywords] = useState(false);
  // Summaries are composed only of the orders the nurse has finished.
  const orders = (summary.orders ?? []).filter((order) => order.status === 'FINISHED');

  // Refetch whenever the current text changes (regenerate, edit, restore).
  useEffect(() => {
    let live = true;
    courseInWardApi
      .versions(summary.id)
      .then(({ data }) => {
        if (!live) return;
        setVersions(data);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [summary.id, summary.summaryContent]);

  const restore = (versionId: string) => {
    setRestoringId(versionId);
    courseInWardApi
      .restoreVersion(summary.id, versionId)
      .then(({ data }) => onRestored(data))
      .catch(() => setFailed(true))
      .finally(() => setRestoringId(null));
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      ariaLabel="Compare versions"
      title={
        <span style={manage.historyTitle}>
          Compare versions
          <InfoTooltip label="What is Compare versions?">
            See this summary next to the texts it replaced, and switch back to an earlier one if
            it reads better. The first card is the version in use.
            <span style={manage.historyLegend}>
              <span>
                <mark style={manage.historyLegendTeal}>Teal</mark> words come from the finished
                doctor's orders — open Show composition to see them.
              </span>
              <span>
                <mark style={manage.historyChanged}>Yellow</mark> words differ from the version in
                use.
              </span>
              <span>Only the last 3 versions are kept.</span>
            </span>
          </InfoTooltip>
        </span>
      }
    >
      <div style={manage.historyGrid}>
        <article
          style={{ ...manage.historyItem, ...manage.historyItemCurrent }}
          aria-label="Version in use"
        >
          <div style={manage.historyMeta}>
            <span style={manage.historyInUse}>✓ In use</span>
            Current version · {SOURCE_LABEL[summary.status]}
          </div>
          <p style={manage.historyText}>
            {showKeywords ? (
              <HighlightedSummary text={summary.summaryContent} orders={orders} />
            ) : (
              summary.summaryContent
            )}
          </p>
          <SummaryComposition
            text={summary.summaryContent}
            orders={orders}
            onToggle={setShowKeywords}
          />
        </article>

        {failed ? (
          <p style={manage.historyEmpty}>The earlier versions could not be loaded. Please try again.</p>
        ) : versions === null ? (
          <p style={manage.historyEmpty}>Loading earlier versions...</p>
        ) : versions.length === 0 ? (
          <p style={manage.historyEmpty}>
            No earlier versions yet. Regenerating or editing keeps the replaced text here.
          </p>
        ) : (
          versions.map((version, index) => (
            <article key={version.id} style={manage.historyItem}>
              <div style={manage.historyMeta}>
                Earlier version {index + 1}
                {index === 0 ? ' (most recent)' : ''} · {SOURCE_LABEL[version.source]}
                <div style={manage.historyReplaced}>
                  Not in use · replaced{' '}
                  {new Date(version.createdAt).toLocaleString('en-GB', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </div>
              </div>
              <p style={manage.historyText}>
                {diffWords(summary.summaryContent, version.content).map(({ token, changed }, i) =>
                  changed ? (
                    <mark key={i} style={manage.historyChanged}>
                      {token}
                    </mark>
                  ) : (
                    token
                  ),
                )}
              </p>
              <SummaryComposition text={version.content} orders={orders} />
              <AiActionButton
                disabled={restoringId !== null}
                aria-busy={restoringId === version.id}
                onClick={() => restore(version.id)}
              >
                {restoringId === version.id ? 'Restoring...' : 'Switch to this version'}
              </AiActionButton>
            </article>
          ))
        )}
      </div>
    </Modal>
  );
}

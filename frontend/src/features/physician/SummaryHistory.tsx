/**
 * Part of the physician dashboard — the "Compare versions" popup:
 * the current Course in the Ward beside its earlier texts, with the words each
 * one changes highlighted, so the physician can pick the one to keep. The
 * selected version's composition sits in a panel beside the list.
 */

import { useEffect, useState } from 'react';
import { courseInWardApi } from '../../services/domainApi';
import { InfoTooltip, Modal } from '../../components/ui';
import type { CourseInWard, SummaryStatus, SummaryVersion } from '../../types';
import { AiActionButton } from '../../components/ai/AiSummaryCard';
import { CompositionPanel, HighlightedSummary } from '../../components/ai/SummaryComposition';
import { manage } from './styles';

/** `selectedId` of the version in use, which has no version id of its own. */
const CURRENT = 'current';

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
  /** The version whose composition the panel shows: a version id, or CURRENT. */
  const [selectedId, setSelectedId] = useState(CURRENT);
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

  // A restore reloads the list, so a selected id can vanish; fall back to the version in use.
  const selectedVersion = versions?.find((version) => version.id === selectedId);
  const selectedText = selectedVersion?.content ?? summary.summaryContent;
  const selectedIndex = selectedVersion ? versions!.indexOf(selectedVersion) : -1;
  const isSelected = (id: string) => (selectedVersion ? selectedVersion.id === id : id === CURRENT);

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
                <mark style={manage.historyLegendTeal}>Teal</mark> words in the selected card come
                from the finished doctor's orders listed in the panel.
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
      <div style={manage.historySplit}>
        <div style={manage.historyList}>
          <article
            style={{
              ...manage.historyItem,
              ...manage.historyItemCurrent,
              ...(isSelected(CURRENT) ? manage.historyItemSelected : {}),
            }}
            aria-label="Version in use"
            onClick={() => setSelectedId(CURRENT)}
          >
            <button type="button" style={manage.historySelect} aria-pressed={isSelected(CURRENT)}>
              <span style={manage.historyInUse}>✓ In use</span>
              Current version · {SOURCE_LABEL[summary.status]}
            </button>
            <p style={manage.historyText}>
              {isSelected(CURRENT) ? (
                <HighlightedSummary text={summary.summaryContent} orders={orders} />
              ) : (
                summary.summaryContent
              )}
            </p>
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
              <article
                key={version.id}
                style={{ ...manage.historyItem, ...(isSelected(version.id) ? manage.historyItemSelected : {}) }}
                onClick={() => setSelectedId(version.id)}
              >
                <button type="button" style={manage.historySelect} aria-pressed={isSelected(version.id)}>
                  Earlier version {index + 1}
                  {index === 0 ? ' (most recent)' : ''} · {SOURCE_LABEL[version.source]}
                  <div style={manage.historyReplaced}>
                    Not in use · replaced{' '}
                    {new Date(version.createdAt).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </button>
                <p style={manage.historyText}>
                  {isSelected(version.id) ? (
                    <HighlightedSummary text={version.content} orders={orders} />
                  ) : (
                    diffWords(summary.summaryContent, version.content).map(({ token, changed }, i) =>
                      changed ? (
                        <mark key={i} style={manage.historyChanged}>
                          {token}
                        </mark>
                      ) : (
                        token
                      ),
                    )
                  )}
                </p>
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

        <aside style={manage.historyPanel} aria-label="Composition of the selected version">
          <h3 style={manage.historyPanelTitle}>
            Composition ·{' '}
            {selectedVersion ? `Earlier version ${selectedIndex + 1}` : 'Version in use'}
          </h3>
          <CompositionPanel text={selectedText} orders={orders} />
        </aside>
      </div>
    </Modal>
  );
}

<?php

namespace App\Support\TabularReview;

/**
 * Single source of truth for the demo presets, ported faithfully from the
 * prototype data file (`tabular-review-demo/project/data.jsx`).
 *
 * Each preset defines:
 *  - key:        preset identifier ('returns','fraud','articles','email','formats')
 *  - emoji / label / sub / description / entity_name: chrome metadata
 *  - row_source: the e-commerce entity table the rows come from
 *  - base_cols:  the non-AI columns (entity data)
 *  - ai_cols:    the LLM/json_path columns — each with index, id, name, prompt,
 *                format, optional enum_values, optional json_path
 *  - rows:       the entity rows (keyed entity data)
 *  - cells:      cooked AI answers per ai_col id, normalized to
 *                {value, flag, citation} (the M2 mock extractor reads these)
 *
 * Cell normalization mirrors the prototype `normCell()`: an entry with only a
 * value defaults to flag 'green'; null/missing → flag 'grey'.
 */
class PresetData
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public static function presets(): array
    {
        return [
            'returns' => self::returns(),
            'fraud' => self::fraud(),
            'articles' => self::articles(),
            'email' => self::email(),
            'formats' => self::formats(),
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return ['returns', 'fraud', 'articles', 'email', 'formats'];
    }

    /**
     * Normalize a raw prototype cell entry to {value, flag, citation}.
     *
     * @param  array<string, mixed>|null  $raw
     * @return array{value: mixed, flag: string, citation: string|null}
     */
    public static function normCell(?array $raw): array
    {
        if ($raw === null) {
            return ['value' => null, 'flag' => 'grey', 'citation' => null];
        }

        if (array_key_exists('v', $raw)) {
            return [
                'value' => $raw['v'],
                'flag' => $raw['flag'] ?? 'green',
                'citation' => $raw['cit'] ?? null,
            ];
        }

        if (array_key_exists('value', $raw)) {
            return [
                'value' => $raw['value'],
                'flag' => $raw['flag'] ?? 'green',
                'citation' => $raw['cit'] ?? $raw['citation'] ?? null,
            ];
        }

        return ['value' => $raw, 'flag' => 'green', 'citation' => null];
    }

    /**
     * Build the columns_config payload (index/name/prompt/format/enum_values/json_path)
     * from a preset's ai_cols. Suitable to store on workflows.columns_config.
     *
     * @param  array<string, mixed>  $preset
     * @return list<array<string, mixed>>
     */
    public static function columnsConfig(array $preset): array
    {
        $out = [];

        foreach ($preset['ai_cols'] as $col) {
            $entry = [
                'index' => $col['index'],
                'name' => $col['name'],
                'prompt' => $col['prompt'],
                'format' => $col['format'],
            ];

            if (isset($col['enum_values'])) {
                $entry['enum_values'] = $col['enum_values'];
            }

            if (isset($col['json_path'])) {
                $entry['json_path'] = $col['json_path'];
            }

            $out[] = $entry;
        }

        return $out;
    }

    private static function returns(): array
    {
        return [
            'key' => 'returns',
            'emoji' => '🛒',
            'label' => 'Triage Resi',
            'sub' => 'Customer service · settimanale',
            'description' => 'Setaccia i resi della settimana, decide rimborso vs escalation in bulk.',
            'entity_name' => 'Reso',
            'row_source' => 'returns_rows',
            'base_cols' => [
                ['id' => 'id', 'name' => 'Reso'],
                ['id' => 'date', 'name' => 'Data'],
                ['id' => 'customer', 'name' => 'Cliente'],
                ['id' => 'amount', 'name' => 'Importo'],
                ['id' => 'reason', 'name' => 'Motivo dichiarato'],
            ],
            'ai_cols' => [
                ['index' => 0, 'id' => 'reason_sem', 'name' => 'Motivo semantico', 'format' => 'enum',
                    'prompt' => 'Classifica il motivo del reso in una sola categoria tra quelle elencate, basandoti sul motivo dichiarato dal cliente e sulla scheda articolo.',
                    'enum_values' => ['Wrong Size', 'Damaged', 'Quality Issue', 'Not As Described', 'Changed Mind', 'Defect', 'Other']],
                ['index' => 1, 'id' => 'serial', 'name' => 'Cliente seriale?', 'format' => 'yes_no',
                    'prompt' => 'Il cliente ha più di 3 resi negli ultimi 12 mesi? Rispondi Yes/No.'],
                ['index' => 2, 'id' => 'margin', 'name' => 'Margine articoli', 'format' => 'monetary_amount',
                    'prompt' => 'Calcola il margine totale dell\'ordine come prezzo_vendita - prezzo_costo per ciascun articolo.'],
                ['index' => 3, 'id' => 'risk', 'name' => 'Risk frode', 'format' => 'rating',
                    'prompt' => 'Valuta il rischio di frode 1–5 incrociando IP, device fingerprint, indirizzo spedizione, storico cliente.'],
                ['index' => 4, 'id' => 'action', 'name' => 'Stato lavorazione', 'format' => 'enum_status',
                    'prompt' => 'Determina lo stato in base a risk score e disponibilità documentale.'],
                ['index' => 5, 'id' => 'confidence', 'name' => 'Confidence', 'format' => 'percentage',
                    'prompt' => '$.action.confidence', 'json_path' => '$.action.confidence'],
                ['index' => 6, 'id' => 'owner', 'name' => 'Owner suggerito', 'format' => 'person',
                    'prompt' => 'Suggerisci l\'operatore CS responsabile per area geografica e specializzazione categoria.'],
                ['index' => 7, 'id' => 'next', 'name' => 'Azione consigliata', 'format' => 'bulleted_list',
                    'prompt' => 'Suggerisci 2-3 azioni operative concrete con priorità.'],
            ],
            'rows' => [
                ['id' => 'RET-1042', 'date' => '14 May', 'customer' => 'Maria Bianchi', 'amount' => '€189,00', 'reason' => 'taglia sbagliata, riprovo con la M'],
                ['id' => 'RET-1043', 'date' => '14 May', 'customer' => 'Luca Rossi', 'amount' => '€72,00', 'reason' => 'articolo difettoso, zip rotta'],
                ['id' => 'RET-1044', 'date' => '14 May', 'customer' => 'Giulia Ferrari', 'amount' => '€458,00', 'reason' => 'non corrispondeva alla descrizione'],
                ['id' => 'RET-1045', 'date' => '13 May', 'customer' => 'Andrea Conti', 'amount' => '€39,90', 'reason' => 'idea mia, non mi serve più'],
                ['id' => 'RET-1046', 'date' => '13 May', 'customer' => 'Sara Greco', 'amount' => '€124,50', 'reason' => 'la stoffa è di scarsa qualità'],
                ['id' => 'RET-1047', 'date' => '13 May', 'customer' => 'Paolo Marchetti', 'amount' => '€2.149,00', 'reason' => 'consegnato danneggiato'],
                ['id' => 'RET-1048', 'date' => '12 May', 'customer' => 'Elena Russo', 'amount' => '€89,00', 'reason' => 'il colore è diverso dalla foto'],
                ['id' => 'RET-1049', 'date' => '12 May', 'customer' => 'Marco Lombardi', 'amount' => '€312,00', 'reason' => 'cambio idea'],
                ['id' => 'RET-1050', 'date' => '12 May', 'customer' => 'Chiara Esposito', 'amount' => '€57,90', 'reason' => 'taglia troppo piccola'],
                ['id' => 'RET-1051', 'date' => '12 May', 'customer' => 'Fabio Galli', 'amount' => '€199,00', 'reason' => 'difettoso, cucitura aperta'],
                ['id' => 'RET-1052', 'date' => '11 May', 'customer' => 'Valentina Moretti', 'amount' => '€84,00', 'reason' => 'non come sul sito'],
                ['id' => 'RET-1053', 'date' => '11 May', 'customer' => 'Roberto Caruso', 'amount' => '€675,00', 'reason' => 'arrivato in ritardo, non mi serve più'],
                ['id' => 'RET-1054', 'date' => '11 May', 'customer' => 'Anna De Luca', 'amount' => '€42,50', 'reason' => 'taglia errata'],
                ['id' => 'RET-1055', 'date' => '10 May', 'customer' => 'Marco Vitale', 'amount' => '€156,00', 'reason' => 'macchia sul tessuto'],
            ],
            'cells' => [
                'reason_sem' => [
                    ['value' => 'Wrong Size', 'flag' => 'green', 'citation' => 'cliente cita "taglia sbagliata"'],
                    ['value' => 'Defect', 'flag' => 'green', 'citation' => 'menzione zip rotta'],
                    ['value' => 'Not As Described', 'flag' => 'yellow', 'citation' => 'evidenze contrastanti scheda vs foto'],
                    ['value' => 'Changed Mind', 'flag' => 'green', 'citation' => 'cliente dichiara cambio idea'],
                    ['value' => 'Quality Issue', 'flag' => 'green', 'citation' => 'menzione qualità stoffa'],
                    ['value' => 'Damaged', 'flag' => 'green', 'citation' => 'tracking GLS conferma urto'],
                    ['value' => 'Not As Described', 'flag' => 'green', 'citation' => 'campo colore mismatch'],
                    ['value' => 'Changed Mind', 'flag' => 'grey', 'citation' => 'nessuna evidenza specifica'],
                    ['value' => 'Wrong Size', 'flag' => 'green', 'citation' => 'taglia S vs M storico cliente'],
                    ['value' => 'Defect', 'flag' => 'green', 'citation' => 'cucitura citata esplicitamente'],
                    ['value' => 'Not As Described', 'flag' => 'yellow', 'citation' => 'frase generica, ambiguo'],
                    ['value' => 'Other', 'flag' => 'yellow', 'citation' => 'ritardo logistico non frode'],
                    ['value' => 'Wrong Size', 'flag' => 'green', 'citation' => 'taglia errata, riacquisto stesso SKU'],
                    ['value' => 'Damaged', 'flag' => 'green', 'citation' => 'foto macchia allegata al reso'],
                ],
                'serial' => [
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'yellow', 'citation' => '5 resi 12mo'],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'red', 'citation' => '11 resi 12mo'],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                ],
                'margin' => [
                    ['value' => '52,40 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '18,90 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '142,80 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '8,50 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '34,20 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '687,50 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '22,10 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '94,00 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '12,60 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '58,90 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '21,30 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '198,40 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '11,80 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '47,00 EUR', 'flag' => 'green', 'citation' => null],
                ],
                'risk' => [
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 2, 'flag' => 'green', 'citation' => null],
                    ['value' => 4, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 2, 'flag' => 'green', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 5, 'flag' => 'red', 'citation' => 'IP 1.2.3.4 ha 4 ordini 18h da 4 device'],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 3, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 2, 'flag' => 'green', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                ],
                'action' => [
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'yellow', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                ],
                'confidence' => [
                    ['value' => 94, 'flag' => 'green', 'citation' => null],
                    ['value' => 91, 'flag' => 'green', 'citation' => null],
                    ['value' => 67, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 96, 'flag' => 'green', 'citation' => null],
                    ['value' => 89, 'flag' => 'green', 'citation' => null],
                    ['value' => 88, 'flag' => 'green', 'citation' => null],
                    ['value' => 92, 'flag' => 'green', 'citation' => null],
                    ['value' => 98, 'flag' => 'green', 'citation' => null],
                    ['value' => 95, 'flag' => 'green', 'citation' => null],
                    ['value' => 90, 'flag' => 'green', 'citation' => null],
                    ['value' => 71, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 84, 'flag' => 'green', 'citation' => null],
                    ['value' => 93, 'flag' => 'green', 'citation' => null],
                    ['value' => 87, 'flag' => 'green', 'citation' => null],
                ],
                'owner' => [
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Luca Bianchi', 'initials' => 'LB', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Marco Riva', 'initials' => 'MR', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Luca Bianchi', 'initials' => 'LB', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Marco Riva', 'initials' => 'MR', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Anna Vitale', 'initials' => 'AV', 'hue' => 340], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Marco Riva', 'initials' => 'MR', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Luca Bianchi', 'initials' => 'LB', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Anna Vitale', 'initials' => 'AV', 'hue' => 340], 'flag' => 'green', 'citation' => null],
                ],
                'next' => [
                    ['value' => ['Approva rimborso', 'Notifica cliente', 'Chiudi ticket'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Apri RMA fornitore', 'Sostituisci articolo'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Richiedi foto al cliente', 'Verifica con merchandiser', 'Decisione manuale'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Notifica cliente'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Tag QC fornitore', 'Trend report mensile'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Apri claim corriere', 'Sostituisci articolo', 'Compensa cliente -€100'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Aggiorna foto sito'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Blocca rimborso', 'Apri istruttoria frode', 'Notifica legale'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Suggerisci taglia M'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Tag QC fornitore', 'Sostituisci articolo'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Richiedi specifica al cliente', 'Decisione manuale'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Compensa cliente -€30', 'Nota al corriere'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Suggerisci taglia M'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Approva rimborso', 'Apri RMA fornitore', 'Tag QC'], 'flag' => 'green', 'citation' => null],
                ],
            ],
        ];
    }

    private static function fraud(): array
    {
        return [
            'key' => 'fraud',
            'emoji' => '🚨',
            'label' => 'Frode Ordini 48h',
            'sub' => 'Fraud analyst · 2× al giorno',
            'description' => 'Ordini PENDING delle ultime 48h, scoring frode + raccomandazione azione.',
            'entity_name' => 'Ordine',
            'row_source' => 'orders',
            'base_cols' => [
                ['id' => 'id', 'name' => 'Ordine'],
                ['id' => 'date', 'name' => 'Quando'],
                ['id' => 'customer', 'name' => 'Cliente'],
                ['id' => 'amount', 'name' => 'Importo'],
                ['id' => 'country', 'name' => 'Paese ship'],
            ],
            'ai_cols' => [
                ['index' => 0, 'id' => 'risk', 'name' => 'Risk', 'format' => 'rating',
                    'prompt' => 'Score frode 1-5 incrociando IP/device/blacklist/storico chargeback.'],
                ['index' => 1, 'id' => 'anomaly', 'name' => 'Anomalia indirizzo', 'format' => 'enum',
                    'prompt' => 'Tipo di anomalia indirizzo se presente.',
                    'enum_values' => ['None', 'Country Mismatch', 'Multiple Cities 24h', 'Blacklisted Region']],
                ['index' => 2, 'id' => 'blacklist', 'name' => 'Match blacklist', 'format' => 'yes_no',
                    'prompt' => 'IP, email o address presenti in blacklist?'],
                ['index' => 3, 'id' => 'pattern', 'name' => 'Pattern', 'format' => 'tags_multi',
                    'prompt' => 'Pattern sospetti rilevati (max 5).'],
                ['index' => 4, 'id' => 'evidence', 'name' => 'Evidenza chiave', 'format' => 'text',
                    'prompt' => 'Una frase con l\'evidenza più forte per il risk score.'],
                ['index' => 5, 'id' => 'action', 'name' => 'Action', 'format' => 'enum_status',
                    'prompt' => 'Azione consigliata.'],
                ['index' => 6, 'id' => 'conf', 'name' => 'Confidence', 'format' => 'percentage',
                    'prompt' => '$.fraud_engine.confidence', 'json_path' => '$.fraud_engine.confidence'],
            ],
            'rows' => [
                ['id' => 'ORD-94521', 'date' => '15 May 09:42', 'customer' => 'A***i M****o', 'amount' => '€1.249,00', 'country' => 'IT'],
                ['id' => 'ORD-94522', 'date' => '15 May 09:48', 'customer' => 'jane.doe@…', 'amount' => '€78,00', 'country' => 'US'],
                ['id' => 'ORD-94523', 'date' => '15 May 09:51', 'customer' => 'F. Bianchi', 'amount' => '€2.847,00', 'country' => 'NG'],
                ['id' => 'ORD-94524', 'date' => '15 May 09:55', 'customer' => 'M. Rossi', 'amount' => '€189,00', 'country' => 'IT'],
                ['id' => 'ORD-94525', 'date' => '15 May 10:02', 'customer' => 'k**i@gmail.com', 'amount' => '€459,00', 'country' => 'IT'],
                ['id' => 'ORD-94526', 'date' => '15 May 10:14', 'customer' => 'S. Gallo', 'amount' => '€124,00', 'country' => 'IT'],
                ['id' => 'ORD-94527', 'date' => '15 May 10:22', 'customer' => 'a***o@protonmail', 'amount' => '€3.299,00', 'country' => 'RO'],
                ['id' => 'ORD-94528', 'date' => '15 May 10:31', 'customer' => 'L. De Luca', 'amount' => '€68,00', 'country' => 'IT'],
                ['id' => 'ORD-94529', 'date' => '15 May 10:48', 'customer' => 'G. Esposito', 'amount' => '€217,00', 'country' => 'IT'],
                ['id' => 'ORD-94530', 'date' => '15 May 10:51', 'customer' => 'r***e@…', 'amount' => '€1.799,00', 'country' => 'IT'],
            ],
            'cells' => [
                'risk' => [
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 2, 'flag' => 'green', 'citation' => null],
                    ['value' => 5, 'flag' => 'red', 'citation' => '4 chargeback storici da quel BIN'],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 4, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 5, 'flag' => 'red', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                    ['value' => 2, 'flag' => 'green', 'citation' => null],
                    ['value' => 4, 'flag' => 'yellow', 'citation' => null],
                ],
                'anomaly' => [
                    ['value' => 'None', 'flag' => 'green', 'citation' => null],
                    ['value' => 'None', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Country Mismatch', 'flag' => 'red', 'citation' => null],
                    ['value' => 'None', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Multiple Cities 24h', 'flag' => 'yellow', 'citation' => null],
                    ['value' => 'None', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Blacklisted Region', 'flag' => 'red', 'citation' => null],
                    ['value' => 'None', 'flag' => 'green', 'citation' => null],
                    ['value' => 'None', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Multiple Cities 24h', 'flag' => 'yellow', 'citation' => null],
                ],
                'blacklist' => [
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'red', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'red', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'green', 'citation' => null],
                ],
                'pattern' => [
                    ['value' => ['legit'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['guest', 'low-amount'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['BIN chargeback', 'high-value', 'first-order'], 'flag' => 'red', 'citation' => null],
                    ['value' => ['legit', 'loyal'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['velocity', '3 devices'], 'flag' => 'yellow', 'citation' => null],
                    ['value' => ['legit'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['bot pattern', 'identical items', 'high-value'], 'flag' => 'red', 'citation' => null],
                    ['value' => ['legit'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['legit'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['velocity', 'new IP'], 'flag' => 'yellow', 'citation' => null],
                ],
                'evidence' => [
                    ['value' => 'Cliente storico 24 ordini, zero chargeback.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Guest checkout, importo basso, IP residenziale IT.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'BIN carta `4***1234` ha 4 chargeback negli ultimi 90gg; ship NG, billing IT.', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Cliente VIP, 47 ordini in 18 mesi.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Lo stesso account ha effettuato 6 ordini in 24h da 3 device diversi.', 'flag' => 'yellow', 'citation' => null],
                    ['value' => 'Cliente noto, pagamento PayPal con account verificato.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Indirizzo spedizione in blacklist `IT-NA-2025-07`; carrello bot pattern (5×identico).', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Cliente fidelizzato, area di consegna abituale.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Profilo regolare, prima volta in carrello esteso.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'IP appena registrato, account creato 12 min prima dell\'ordine.', 'flag' => 'yellow', 'citation' => null],
                ],
                'action' => [
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                ],
                'conf' => [
                    ['value' => 98, 'flag' => 'green', 'citation' => null],
                    ['value' => 94, 'flag' => 'green', 'citation' => null],
                    ['value' => 99, 'flag' => 'green', 'citation' => null],
                    ['value' => 97, 'flag' => 'green', 'citation' => null],
                    ['value' => 76, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 96, 'flag' => 'green', 'citation' => null],
                    ['value' => 99, 'flag' => 'green', 'citation' => null],
                    ['value' => 95, 'flag' => 'green', 'citation' => null],
                    ['value' => 91, 'flag' => 'green', 'citation' => null],
                    ['value' => 72, 'flag' => 'yellow', 'citation' => null],
                ],
            ],
        ];
    }

    private static function articles(): array
    {
        return [
            'key' => 'articles',
            'emoji' => '📦',
            'label' => 'Audit Schede SS26',
            'sub' => 'Merchandiser · inizio stagione',
            'description' => 'Verifica completezza descrizioni, SEO, alt-text, traduzioni su 1.247 SKU.',
            'entity_name' => 'Articolo',
            'row_source' => 'articles',
            'base_cols' => [
                ['id' => 'sku', 'name' => 'SKU'],
                ['id' => 'name', 'name' => 'Nome'],
                ['id' => 'brand', 'name' => 'Brand'],
                ['id' => 'price', 'name' => 'Prezzo'],
            ],
            'ai_cols' => [
                ['index' => 0, 'id' => 'desc_ok', 'name' => 'Descrizione completa?', 'format' => 'yes_no',
                    'prompt' => 'Descrizione ≥150 char + materiale + caratteristiche?'],
                ['index' => 1, 'id' => 'seo', 'name' => 'SEO score', 'format' => 'percentage',
                    'prompt' => 'Title + description + density + readability Flesch IT.'],
                ['index' => 2, 'id' => 'alt', 'name' => 'Alt text OK?', 'format' => 'yes_no',
                    'prompt' => 'Tutte le immagini hanno alt_text > 5 char?'],
                ['index' => 3, 'id' => 'lang', 'name' => 'Lingue mancanti', 'format' => 'tags_multi',
                    'prompt' => 'Locali per cui manca la traduzione (en/es/de/fr).'],
                ['index' => 4, 'id' => 'tags', 'name' => 'Tag suggeriti', 'format' => 'tags_multi',
                    'prompt' => '3-5 tag basati su brand, materiale, occasione d\'uso.'],
                ['index' => 5, 'id' => 'status', 'name' => 'Qualità complessiva', 'format' => 'enum_status',
                    'prompt' => 'todo / in_progress / done / blocked.'],
                ['index' => 6, 'id' => 'compete', 'name' => 'Link competitor', 'format' => 'url',
                    'prompt' => 'URL del prodotto comparabile su Zalando se esiste.'],
            ],
            'rows' => [
                ['sku' => 'ART-7821', 'name' => 'Cappotto cammello midi · 100% lana', 'brand' => 'Liu Jo', 'price' => '€349,00'],
                ['sku' => 'ART-7822', 'name' => 'Sneaker basket platform bianca', 'brand' => 'Veja', 'price' => '€140,00'],
                ['sku' => 'ART-7823', 'name' => 'Trench impermeabile beige doppiopetto', 'brand' => 'Burberry', 'price' => '€1.890,00'],
                ['sku' => 'ART-7824', 'name' => 'Camicia oxford navy slim', 'brand' => 'Brooks Bros.', 'price' => '€129,00'],
                ['sku' => 'ART-7825', 'name' => 'Jeans skinny push-up dark blue', 'brand' => 'Replay', 'price' => '€189,00'],
                ['sku' => 'ART-7826', 'name' => 'Borsa hobo pelle martellata cuoio', 'brand' => 'Furla', 'price' => '€420,00'],
                ['sku' => 'ART-7827', 'name' => 'Pochette clutch raso nero strass', 'brand' => 'Twin-Set', 'price' => '€89,00'],
                ['sku' => 'ART-7828', 'name' => 'T-shirt logo bianca cotone bio', 'brand' => 'Stone Island', 'price' => '€85,00'],
                ['sku' => 'ART-7829', 'name' => 'Maglione girocollo cashmere antracite', 'brand' => 'Eleventy', 'price' => '€499,00'],
                ['sku' => 'ART-7830', 'name' => 'Stivaletti tronchetto pelle bordeaux', 'brand' => 'Aeyde', 'price' => '€340,00'],
            ],
            'cells' => [
                'desc_ok' => [
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'yellow', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                ],
                'seo' => [
                    ['value' => 87, 'flag' => 'green', 'citation' => null],
                    ['value' => 34, 'flag' => 'red', 'citation' => null],
                    ['value' => 92, 'flag' => 'green', 'citation' => null],
                    ['value' => 78, 'flag' => 'green', 'citation' => null],
                    ['value' => 41, 'flag' => 'red', 'citation' => null],
                    ['value' => 81, 'flag' => 'green', 'citation' => null],
                    ['value' => 58, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 75, 'flag' => 'green', 'citation' => null],
                    ['value' => 88, 'flag' => 'green', 'citation' => null],
                    ['value' => 83, 'flag' => 'green', 'citation' => null],
                ],
                'alt' => [
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => '3/4 img senza alt'],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'yellow', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                ],
                'lang' => [
                    ['value' => [], 'flag' => 'green', 'citation' => null],
                    ['value' => ['en', 'es', 'de'], 'flag' => 'red', 'citation' => null],
                    ['value' => ['de'], 'flag' => 'green', 'citation' => null],
                    ['value' => [], 'flag' => 'green', 'citation' => null],
                    ['value' => ['en', 'es'], 'flag' => 'yellow', 'citation' => null],
                    ['value' => [], 'flag' => 'green', 'citation' => null],
                    ['value' => ['de', 'fr'], 'flag' => 'yellow', 'citation' => null],
                    ['value' => [], 'flag' => 'green', 'citation' => null],
                    ['value' => ['fr'], 'flag' => 'green', 'citation' => null],
                    ['value' => [], 'flag' => 'green', 'citation' => null],
                ],
                'tags' => [
                    ['value' => ['outerwear', 'wool', 'winter', 'formal'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['sneakers', 'platform', 'sustainable', 'casual'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['outerwear', 'luxury', 'waterproof', 'heritage'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['shirt', 'oxford', 'navy', 'smart-casual'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['denim', 'skinny', 'push-up'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['bag', 'hobo', 'leather', 'everyday'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['evening', 'clutch', 'crystal', 'pochette'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['t-shirt', 'organic', 'logo', 'streetwear'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['knitwear', 'cashmere', 'luxury', 'winter'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['boots', 'leather', 'bordeaux', 'autumn'], 'flag' => 'green', 'citation' => null],
                ],
                'status' => [
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                ],
                'compete' => [
                    ['value' => 'https://zalando.it/liu-jo-cappotto', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://zalando.it/veja-v10-bianca', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://zalando.it/burberry-trench', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://farfetch.com/brooks-oxford', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://zalando.it/replay-jeans', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://zalando.it/furla-hobo', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://yoox.com/twinset-clutch', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://stoneisland.com/tee-logo', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://mytheresa.com/eleventy-cashmere', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://zalando.it/aeyde-stivaletti', 'flag' => 'green', 'citation' => null],
                ],
            ],
        ];
    }

    private static function email(): array
    {
        return [
            'key' => 'email',
            'emoji' => '💌',
            'label' => 'Audit Campagne Email',
            'sub' => 'Marketing · mensile',
            'description' => 'Analisi 47 campagne del mese — subject, segment, ottimizzazioni concrete.',
            'entity_name' => 'Campagna',
            'row_source' => 'email_campaigns',
            'base_cols' => [
                ['id' => 'id', 'name' => 'ID'],
                ['id' => 'name', 'name' => 'Campagna'],
                ['id' => 'sent', 'name' => 'Inviata'],
                ['id' => 'opens', 'name' => 'Open %'],
            ],
            'ai_cols' => [
                ['index' => 0, 'id' => 'ctr', 'name' => 'CTR vs media', 'format' => 'percentage',
                    'prompt' => '$.metadata.ctr_vs_baseline', 'json_path' => '$.metadata.ctr_vs_baseline'],
                ['index' => 1, 'id' => 'subj', 'name' => 'Soggetto efficace?', 'format' => 'yes_no',
                    'prompt' => 'Subject ben costruito vs top-performer storici?'],
                ['index' => 2, 'id' => 'aud', 'name' => 'Audience corretto?', 'format' => 'yes_no',
                    'prompt' => 'Segment criteria coerenti col prodotto promosso?'],
                ['index' => 3, 'id' => 'best', 'name' => 'Best segment', 'format' => 'text',
                    'prompt' => 'Segment più convertente per categoria simile (max 80 char).'],
                ['index' => 4, 'id' => 'opt', 'name' => 'Ottimizzazione', 'format' => 'bulleted_list',
                    'prompt' => '3 punti concreti di miglioramento.'],
                ['index' => 5, 'id' => 'owner', 'name' => 'Owner fix', 'format' => 'person',
                    'prompt' => 'A chi assegnare la fix.'],
                ['index' => 6, 'id' => 'status', 'name' => 'Stato', 'format' => 'enum_status',
                    'prompt' => 'todo / in_progress / done / blocked.'],
            ],
            'rows' => [
                ['id' => 'C-417', 'name' => 'SS26 Drop — New Arrivals', 'sent' => '02 May', 'opens' => '24.8'],
                ['id' => 'C-418', 'name' => 'Sale -30% Brand della Settimana', 'sent' => '04 May', 'opens' => '11.2'],
                ['id' => 'C-419', 'name' => 'Festa della Mamma · idee regalo', 'sent' => '06 May', 'opens' => '38.4'],
                ['id' => 'C-420', 'name' => 'Re-engagement dormienti 90gg', 'sent' => '07 May', 'opens' => '6.1'],
                ['id' => 'C-421', 'name' => 'Outdoor SS · trekking essentials', 'sent' => '09 May', 'opens' => '19.2'],
                ['id' => 'C-422', 'name' => 'Cashback VIP -20% codice singolo', 'sent' => '11 May', 'opens' => '42.7'],
                ['id' => 'C-423', 'name' => 'Abandoned cart 24h flash', 'sent' => '12 May', 'opens' => '28.9'],
                ['id' => 'C-424', 'name' => 'New brand · Designer X', 'sent' => '13 May', 'opens' => '14.8'],
            ],
            'cells' => [
                'ctr' => [
                    ['value' => '+18%', 'flag' => 'green', 'citation' => null],
                    ['value' => '-42%', 'flag' => 'red', 'citation' => null],
                    ['value' => '+71%', 'flag' => 'green', 'citation' => null],
                    ['value' => '-67%', 'flag' => 'red', 'citation' => null],
                    ['value' => '-8%', 'flag' => 'yellow', 'citation' => null],
                    ['value' => '+89%', 'flag' => 'green', 'citation' => null],
                    ['value' => '+24%', 'flag' => 'green', 'citation' => null],
                    ['value' => '-19%', 'flag' => 'yellow', 'citation' => null],
                ],
                'subj' => [
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'yellow', 'citation' => null],
                ],
                'aud' => [
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                ],
                'best' => [
                    ['value' => 'New visitors 14gg + interesse outerwear', 'flag' => 'green', 'citation' => null],
                    ['value' => 'High-value loyalty tier', 'flag' => 'green', 'citation' => null],
                    ['value' => 'F 25-45 + interesse gifting', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Dormienti 30-60gg con storico ≥€100', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Outdoor + viaggio + storico active', 'flag' => 'green', 'citation' => null],
                    ['value' => 'VIP top decile', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Carrello abbandonato 12h', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Fashion-forward + brand sim', 'flag' => 'green', 'citation' => null],
                ],
                'opt' => [
                    ['value' => ['CTA chiara: "Scopri SS26"', 'Hero image più immediata'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Subject troppo lungo: 87 char (target <50)', 'CTA generica: "Scopri di più" → "Scopri il -30%"', 'Timing: 02:14 GMT → audience IT dorme'], 'flag' => 'red', 'citation' => null],
                    ['value' => ['Segment già ottimo', 'Test variante con video al primo fold'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Subject troppo aggressivo', 'Manca incentivo concreto', 'Inviata di sabato sera, basso engagement'], 'flag' => 'red', 'citation' => null],
                    ['value' => ['Subject ok', 'Espandi audience a "outdoor+running"'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Mantieni format', 'Test push notification companion'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Add countdown timer dinamico', 'Personalizza prodotto in hero'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Subject vago: brand sconosciuto', 'Aggiungi social proof'], 'flag' => 'green', 'citation' => null],
                ],
                'owner' => [
                    ['value' => ['name' => 'Giulia P.', 'initials' => 'GP', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Mark Email', 'initials' => 'ME', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Giulia P.', 'initials' => 'GP', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Mark Email', 'initials' => 'ME', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Giulia P.', 'initials' => 'GP', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Giulia P.', 'initials' => 'GP', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Lia Crm', 'initials' => 'LC', 'hue' => 340], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Mark Email', 'initials' => 'ME', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                ],
                'status' => [
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                ],
            ],
        ];
    }

    private static function formats(): array
    {
        return [
            'key' => 'formats',
            'emoji' => '🌈',
            'label' => 'Tutti i 16 formati',
            'sub' => 'Showcase visivo · ogni colonna un tipo',
            'description' => 'Ogni colonna mostra uno dei 16 format type renderizzato dalla griglia.',
            'entity_name' => 'Esempio',
            'row_source' => 'articles',
            'base_cols' => [
                ['id' => 'name', 'name' => 'Caso d\'uso'],
            ],
            'ai_cols' => [
                ['index' => 0, 'id' => 'f_text', 'name' => 'text', 'format' => 'text', 'prompt' => '…'],
                ['index' => 1, 'id' => 'f_list', 'name' => 'bulleted_list', 'format' => 'bulleted_list', 'prompt' => '…'],
                ['index' => 2, 'id' => 'f_num', 'name' => 'number', 'format' => 'number', 'prompt' => '…'],
                ['index' => 3, 'id' => 'f_pct', 'name' => 'percentage', 'format' => 'percentage', 'prompt' => '…'],
                ['index' => 4, 'id' => 'f_money', 'name' => 'monetary_amount', 'format' => 'monetary_amount', 'prompt' => '…'],
                ['index' => 5, 'id' => 'f_cur', 'name' => 'currency', 'format' => 'currency', 'prompt' => '…'],
                ['index' => 6, 'id' => 'f_yn', 'name' => 'yes_no', 'format' => 'yes_no', 'prompt' => '…'],
                ['index' => 7, 'id' => 'f_date', 'name' => 'date', 'format' => 'date', 'prompt' => '…'],
                ['index' => 8, 'id' => 'f_tag', 'name' => 'tag', 'format' => 'tag', 'prompt' => '…'],
                ['index' => 9, 'id' => 'f_enum', 'name' => 'enum', 'format' => 'enum', 'prompt' => '…',
                    'enum_values' => ['Low', 'Medium', 'High', 'Critical']],
                ['index' => 10, 'id' => 'f_estatus', 'name' => 'enum_status', 'format' => 'enum_status', 'prompt' => '…'],
                ['index' => 11, 'id' => 'f_rate', 'name' => 'rating', 'format' => 'rating', 'prompt' => '…'],
                ['index' => 12, 'id' => 'f_url', 'name' => 'url', 'format' => 'url', 'prompt' => '…'],
                ['index' => 13, 'id' => 'f_person', 'name' => 'person', 'format' => 'person', 'prompt' => '…'],
                ['index' => 14, 'id' => 'f_tagsm', 'name' => 'tags_multi', 'format' => 'tags_multi', 'prompt' => '…'],
                ['index' => 15, 'id' => 'f_rel', 'name' => 'relation', 'format' => 'relation', 'prompt' => '…'],
            ],
            'rows' => [
                ['name' => 'Cliente VIP "Maria B." review'],
                ['name' => 'Articolo ART-7821 SS26'],
                ['name' => 'Ordine ORD-94521 IT'],
                ['name' => 'Campagna C-417 Drop'],
                ['name' => 'Reso RET-1042'],
            ],
            'cells' => [
                'f_text' => [
                    ['value' => 'Cliente storico, 24 ordini, NPS 9/10.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Cappotto cammello midi, 100% lana vergine, made in Italy.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Importo €1.249, pagamento PayPal verificato.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Drop SS26 ben performante, top 3 mese.', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Reso entro finestra, motivo legittimo.', 'flag' => 'green', 'citation' => null],
                ],
                'f_list' => [
                    ['value' => ['Spedizione express gratuita', 'Concierge dedicato', 'Anteprime collezioni'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Composizione 100% lana', 'Lavabile a secco', 'Made in Italy'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Pagamento verificato', 'Indirizzo certificato', 'Cliente loyalty Gold'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Open rate +18%', 'Revenue €124k', 'Conv. 3.2%'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['Rimborso pieno', 'Ritiro corriere', 'Notifica al cliente'], 'flag' => 'green', 'citation' => null],
                ],
                'f_num' => [
                    ['value' => 24, 'flag' => 'green', 'citation' => null],
                    ['value' => 1247, 'flag' => 'green', 'citation' => null],
                    ['value' => 4, 'flag' => 'green', 'citation' => null],
                    ['value' => 47, 'flag' => 'green', 'citation' => null],
                    ['value' => 14, 'flag' => 'green', 'citation' => null],
                ],
                'f_pct' => [
                    ['value' => 92, 'flag' => 'green', 'citation' => null],
                    ['value' => 87, 'flag' => 'green', 'citation' => null],
                    ['value' => 76, 'flag' => 'yellow', 'citation' => null],
                    ['value' => 24.8, 'flag' => 'green', 'citation' => null],
                    ['value' => 94, 'flag' => 'green', 'citation' => null],
                ],
                'f_money' => [
                    ['value' => '4.328,00 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '349,00 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '1.249,00 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '124.330,00 EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => '189,00 EUR', 'flag' => 'green', 'citation' => null],
                ],
                'f_cur' => [
                    ['value' => 'EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => 'EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => 'EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => 'EUR', 'flag' => 'green', 'citation' => null],
                    ['value' => 'EUR', 'flag' => 'green', 'citation' => null],
                ],
                'f_yn' => [
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'No', 'flag' => 'yellow', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Yes', 'flag' => 'green', 'citation' => null],
                ],
                'f_date' => [
                    ['value' => '2024-08-12', 'flag' => 'green', 'citation' => null],
                    ['value' => '2026-03-01', 'flag' => 'green', 'citation' => null],
                    ['value' => '2026-05-15', 'flag' => 'green', 'citation' => null],
                    ['value' => '2026-05-02', 'flag' => 'green', 'citation' => null],
                    ['value' => '2026-05-14', 'flag' => 'green', 'citation' => null],
                ],
                'f_tag' => [
                    ['value' => 'VIP-Gold', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Outerwear', 'flag' => 'green', 'citation' => null],
                    ['value' => 'High-value', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Drop', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Approved', 'flag' => 'green', 'citation' => null],
                ],
                'f_enum' => [
                    ['value' => 'High', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Medium', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Critical', 'flag' => 'red', 'citation' => null],
                    ['value' => 'Medium', 'flag' => 'green', 'citation' => null],
                    ['value' => 'Low', 'flag' => 'green', 'citation' => null],
                ],
                'f_estatus' => [
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'in_progress', 'flag' => 'green', 'citation' => null],
                    ['value' => 'blocked', 'flag' => 'red', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                    ['value' => 'done', 'flag' => 'green', 'citation' => null],
                ],
                'f_rate' => [
                    ['value' => 5, 'flag' => 'green', 'citation' => null],
                    ['value' => 4, 'flag' => 'green', 'citation' => null],
                    ['value' => 5, 'flag' => 'red', 'citation' => null],
                    ['value' => 4, 'flag' => 'green', 'citation' => null],
                    ['value' => 1, 'flag' => 'green', 'citation' => null],
                ],
                'f_url' => [
                    ['value' => 'https://gescat.com/customers/24891', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://gescat.com/articoli/7821', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://gescat.com/ordini/94521', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://gescat.com/campagne/417', 'flag' => 'green', 'citation' => null],
                    ['value' => 'https://gescat.com/resi/1042', 'flag' => 'green', 'citation' => null],
                ],
                'f_person' => [
                    ['value' => ['name' => 'Anna Vitale', 'initials' => 'AV', 'hue' => 340], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Marco Riva', 'initials' => 'MR', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Luca Bianchi', 'initials' => 'LB', 'hue' => 200], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Giulia P.', 'initials' => 'GP', 'hue' => 280], 'flag' => 'green', 'citation' => null],
                    ['value' => ['name' => 'Sara Conte', 'initials' => 'SC', 'hue' => 12], 'flag' => 'green', 'citation' => null],
                ],
                'f_tagsm' => [
                    ['value' => ['vip', 'italy', 'active'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['wool', 'winter', 'luxury', 'formal'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['high-value', 'first-order', 'flagged'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['ss26', 'drop', 'newsletter', 'organic'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['wrong-size', 'legit'], 'flag' => 'green', 'citation' => null],
                ],
                'f_rel' => [
                    ['value' => ['kind' => 'customer', 'label' => 'clienti:24891'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['kind' => 'article', 'label' => 'articoli:7821'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['kind' => 'order', 'label' => 'ordini:94521'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['kind' => 'campaign', 'label' => 'campagne:417'], 'flag' => 'green', 'citation' => null],
                    ['value' => ['kind' => 'return', 'label' => 'resi:1042'], 'flag' => 'green', 'citation' => null],
                ],
            ],
        ];
    }
}

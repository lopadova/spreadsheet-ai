<?php

declare(strict_types=1);

namespace App\Http\Requests\TabularReview;

use App\Support\TabularReview\FormatType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the shape of a column being added or edited.
 *
 *  - name        required string
 *  - format      required, ∈ FormatType::values()
 *  - prompt      optional string
 *  - enum_values required (non-empty list) iff format = enum
 *  - json_path   required iff format = json_path
 */
class ColumnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'format' => ['required', 'string', Rule::in(FormatType::values())],
            'prompt' => ['nullable', 'string', 'max:2000'],
            'enum_values' => [
                'array',
                Rule::requiredIf(fn () => $this->input('format') === FormatType::ENUM->value),
            ],
            'enum_values.*' => ['string', 'max:120'],
            'json_path' => [
                'nullable',
                'string',
                'max:200',
                Rule::requiredIf(fn () => $this->input('format') === FormatType::JSON_PATH->value),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'enum_values.required' => 'enum_values is required when format is "enum".',
            'json_path.required' => 'json_path is required when format is "json_path".',
        ];
    }
}

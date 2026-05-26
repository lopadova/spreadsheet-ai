<?php

declare(strict_types=1);

namespace App\Ai;

use RuntimeException;

/**
 * Raised when the underlying AI provider call fails.
 *
 * SECURITY: the message carried by this exception is a GENERIC, user-safe
 * string ("provider error") — never the raw provider exception message,
 * which may leak hostnames, API keys, or auth headers. The real provider
 * message is logged server-side at the throw site.
 */
class AiException extends RuntimeException
{
}

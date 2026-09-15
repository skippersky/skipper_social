import { describe, expect, it } from 'vitest';
import {
  BIO_MAX,
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MIN,
  TWO_FACTOR_CODE_LENGTH,
  isProfileValid,
  isTwoFactorCodeValid,
  missingPasswordRules,
  passwordStrength,
  validateBio,
  validateConfirmPassword,
  validateCredentials,
  validateEmail,
  validateName,
  validateNewPassword,
  validatePasswordForm,
  validatePhone,
  validateProfile
} from '../lib/settingsValidation';
import type { CredentialField } from '../providers/types';
import type { SettingsProfile } from '../types';

function field(overrides: Partial<CredentialField> = {}): CredentialField {
  return {
    key: 'access_token',
    label: 'Access Token',
    type: 'password',
    placeholder: 'paste the token',
    required: true,
    ...overrides
  };
}

function profileForm(overrides: Partial<SettingsProfile> = {}): Partial<SettingsProfile> {
  return {
    name: 'Amani Juma',
    email: 'amani@kilimax.com',
    phone: '+255 712 345 678',
    bio: 'Social commerce in Dar es Salaam.',
    ...overrides
  };
}

function repeat(char: string, times: number): string {
  return new Array(times + 1).join(char);
}

describe('settings validation limits', () => {
  it('publishes the documented budgets', () => {
    expect(NAME_MIN).toBe(2);
    expect(NAME_MAX).toBe(50);
    expect(BIO_MAX).toBe(200);
    expect(PASSWORD_MIN).toBe(8);
    expect(TWO_FACTOR_CODE_LENGTH).toBe(6);
  });
});

describe('validateName', () => {
  it('rejects a blank name', () => {
    expect(validateName('')).toBe('settings.error.nameRequired');
    expect(validateName('   ')).toBe('settings.error.nameRequired');
  });

  it('enforces the 2 to 50 character window', () => {
    expect(validateName('A')).toBe('settings.error.nameLength');
    expect(validateName(repeat('a', NAME_MAX + 1))).toBe('settings.error.nameLength');
    expect(validateName('Bo')).toBeNull();
    expect(validateName(repeat('a', NAME_MAX))).toBeNull();
  });

  it('trims surrounding whitespace before measuring', () => {
    expect(validateName('  Amani  ')).toBeNull();
    expect(validateName(' A ')).toBe('settings.error.nameLength');
  });
});

describe('validateEmail', () => {
  it('requires a value', () => {
    expect(validateEmail('')).toBe('settings.error.emailRequired');
    expect(validateEmail('  ')).toBe('settings.error.emailRequired');
  });

  it('rejects malformed addresses', () => {
    expect(validateEmail('nope')).toBe('settings.error.emailInvalid');
    expect(validateEmail('a@b')).toBe('settings.error.emailInvalid');
    expect(validateEmail('a b@c.co')).toBe('settings.error.emailInvalid');
  });

  it('accepts a normal address and trims it', () => {
    expect(validateEmail('amani@kilimax.com')).toBeNull();
    expect(validateEmail('  amani@kilimax.com ')).toBeNull();
  });
});

describe('validatePhone', () => {
  it('treats the field as optional', () => {
    expect(validatePhone('')).toBeNull();
    expect(validatePhone('   ')).toBeNull();
  });

  it('accepts international and local shapes', () => {
    expect(validatePhone('+255712345678')).toBeNull();
    expect(validatePhone('+255 712 345 678')).toBeNull();
    expect(validatePhone('0712-345-678')).toBeNull();
  });

  it('rejects too short, too long and non numeric values', () => {
    expect(validatePhone('123')).toBe('settings.error.phoneInvalid');
    expect(validatePhone(repeat('9', 16))).toBe('settings.error.phoneInvalid');
    expect(validatePhone('abcdefg')).toBe('settings.error.phoneInvalid');
    /* a leading bracket is outside the accepted international shape */
    expect(validatePhone('(0712) 345 678')).toBe('settings.error.phoneInvalid');
  });
});

describe('validateBio', () => {
  it('allows an empty or budget sized bio', () => {
    expect(validateBio('')).toBeNull();
    expect(validateBio(repeat('b', BIO_MAX))).toBeNull();
  });

  it('rejects a bio over the budget', () => {
    expect(validateBio(repeat('b', BIO_MAX + 1))).toBe('settings.error.bioTooLong');
  });
});

describe('validateProfile', () => {
  it('returns no errors for a complete form', () => {
    expect(validateProfile(profileForm())).toEqual({});
    expect(isProfileValid(profileForm())).toBe(true);
  });

  it('collects every broken rule at once', () => {
    const errors = validateProfile(
      profileForm({
        name: 'A',
        email: 'nope',
        phone: '12',
        bio: repeat('b', BIO_MAX + 1)
      })
    );

    expect(errors).toEqual({
      name: 'settings.error.nameLength',
      email: 'settings.error.emailInvalid',
      phone: 'settings.error.phoneInvalid',
      bio: 'settings.error.bioTooLong'
    });
    expect(isProfileValid(profileForm({ name: 'A' }))).toBe(false);
  });

  it('still requires name and email when everything else is absent', () => {
    expect(validateProfile({})).toEqual({
      name: 'settings.error.nameRequired',
      email: 'settings.error.emailRequired'
    });
  });
});

describe('password rules', () => {
  it('lists the missing rules in meter order', () => {
    expect(missingPasswordRules('')).toEqual([
      'settings.error.passwordLength',
      'settings.error.passwordLower',
      'settings.error.passwordUpper',
      'settings.error.passwordDigit'
    ]);
    expect(missingPasswordRules('abcdefgh')).toEqual([
      'settings.error.passwordUpper',
      'settings.error.passwordDigit'
    ]);
    expect(missingPasswordRules('Abcdef1x')).toEqual([]);
  });

  it('scores strength from empty to strong', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0, valid: false });
    expect(passwordStrength('abc')).toMatchObject({ score: 1, valid: false });
    expect(passwordStrength('Abcdef1x')).toMatchObject({ score: 2, valid: true });
    expect(passwordStrength('Abcdefghijk1')).toMatchObject({ score: 3, valid: true });
    expect(passwordStrength('Abcdef1x!')).toMatchObject({ score: 3, valid: true });
    expect(passwordStrength('Abcdefghijk1!')).toMatchObject({ score: 4, valid: true });
  });

  it('reports the first unmet rule for a new password', () => {
    expect(validateNewPassword('')).toBe('settings.error.passwordRequired');
    expect(validateNewPassword('abc')).toBe('settings.error.passwordLength');
    expect(validateNewPassword('Abcdefgh')).toBe('settings.error.passwordDigit');
    expect(validateNewPassword('Abcdef1x')).toBeNull();
  });

  it('checks the confirmation field', () => {
    expect(validateConfirmPassword('Abcdef1x', '')).toBe('settings.error.confirmRequired');
    expect(validateConfirmPassword('Abcdef1x', 'Abcdef1y')).toBe(
      'settings.error.passwordMismatch'
    );
    expect(validateConfirmPassword('Abcdef1x', 'Abcdef1x')).toBeNull();
  });
});

describe('validatePasswordForm', () => {
  it('flags every empty field', () => {
    expect(
      validatePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    ).toEqual({
      currentPassword: 'settings.error.currentPasswordRequired',
      newPassword: 'settings.error.passwordRequired',
      confirmPassword: 'settings.error.confirmRequired'
    });
  });

  it('accepts a valid rotation', () => {
    expect(
      validatePasswordForm({
        currentPassword: 'Old12345',
        newPassword: 'New12345',
        confirmPassword: 'New12345'
      })
    ).toEqual({});
  });

  it('rejects reusing the current password even when it is strong', () => {
    expect(
      validatePasswordForm({
        currentPassword: 'Same1234',
        newPassword: 'Same1234',
        confirmPassword: 'Same1234'
      })
    ).toEqual({ newPassword: 'settings.error.passwordSame' });
  });

  it('reports the strength failure before it ever checks reuse', () => {
    expect(
      validatePasswordForm({
        currentPassword: 'abc',
        newPassword: 'abc',
        confirmPassword: 'abc'
      })
    ).toEqual({ newPassword: 'settings.error.passwordLength' });
  });

  it('reports a mismatched confirmation on its own', () => {
    expect(
      validatePasswordForm({
        currentPassword: 'Old12345',
        newPassword: 'New12345',
        confirmPassword: 'New12346'
      })
    ).toEqual({ confirmPassword: 'settings.error.passwordMismatch' });
  });
});

describe('isTwoFactorCodeValid', () => {
  it('accepts exactly six digits and trims them', () => {
    expect(isTwoFactorCodeValid('123456')).toBe(true);
    expect(isTwoFactorCodeValid(' 123456 ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTwoFactorCodeValid('')).toBe(false);
    expect(isTwoFactorCodeValid('12345')).toBe(false);
    expect(isTwoFactorCodeValid('1234567')).toBe(false);
    expect(isTwoFactorCodeValid('12345a')).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('requires every mandatory field', () => {
    expect(validateCredentials([field()], {})).toEqual({
      access_token: 'common.required'
    });
    expect(validateCredentials([field()], { access_token: '   ' })).toEqual({
      access_token: 'common.required'
    });
  });

  it('skips optional fields that stay empty', () => {
    expect(validateCredentials([field({ required: false })], {})).toEqual({});
    expect(validateCredentials([field({ required: false })], { access_token: '' })).toEqual({});
  });

  it('rejects values shorter than four characters', () => {
    expect(validateCredentials([field()], { access_token: 'abc' })).toEqual({
      access_token: 'settings.error.credentialTooShort'
    });
    expect(validateCredentials([field()], { access_token: 'abcd' })).toEqual({});
  });

  it('reports each platform field separately', () => {
    const fields = [
      field({ key: 'page_id', label: 'Page ID', type: 'text', placeholder: 'id' }),
      field({ key: 'page_access_token' })
    ];

    expect(validateCredentials(fields, { page_id: 'ok-value' })).toEqual({
      page_access_token: 'common.required'
    });
  });
});

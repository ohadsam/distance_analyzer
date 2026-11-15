package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BackupMathTest {
    @Test fun readsWithinTheLimitAndRefusesMore() {
        assertEquals("héllo", BackupMath.readLimited("héllo".byteInputStream(), 100))
        assertNull(BackupMath.readLimited(ByteArray(101).inputStream(), 100))
        assertEquals("", BackupMath.readLimited(ByteArray(0).inputStream(), 100))
    }
    @Test fun namesAreSafe() {
        assertEquals("stepup-backup-2026-11-15.json", BackupMath.safeName("stepup-backup-2026-11-15.json"))
        assertEquals(".._.._etc_passwd", BackupMath.safeName("../../etc/passwd"))
        assertEquals("stepup-backup.json", BackupMath.safeName(""))
        assertEquals(60, BackupMath.safeName("a".repeat(200)).length)
    }
}

package com.vocabreview

import android.app.Application
import com.vocabreview.data.CredentialStore
import com.vocabreview.data.VocabRepository
import com.vocabreview.util.AppLifecycleObserver
import androidx.lifecycle.ProcessLifecycleOwner

class VocabReviewApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CredentialStore.init(this)
        VocabRepository.init(this)
        VocabRepository.get().loadCachedWords()

        ProcessLifecycleOwner.get().lifecycle.addObserver(
            AppLifecycleObserver(VocabRepository.get())
        )
    }
}

package com.vocabreview.util

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.vocabreview.data.VocabRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AppLifecycleObserver(
    private val repository: VocabRepository
) : DefaultLifecycleObserver {

    override fun onStop(owner: LifecycleOwner) {
        // App went to background — push any pending changes
        CoroutineScope(Dispatchers.IO).launch {
            repository.pushIfNeeded()
        }
    }
}
